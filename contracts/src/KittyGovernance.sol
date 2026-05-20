// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

/// @notice Minimal Circles V2 Hub interface used by the kitty.
interface IHub {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function toTokenId(address avatar) external pure returns (uint256);
}

/// @notice Minimal ERC-1155 receiver interface (subset of OpenZeppelin's).
interface IERC1155Receiver {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}

/// @notice ERC-165 introspection, required for `supportsInterface`.
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title  KittyGovernance
/// @notice Custodial group treasury for a Circles V2 base group.
///
///         The contract:
///         - holds the group's pot tokens (ERC-1155 from Hub) on behalf of members,
///         - tracks per-member contributions for future redemption,
///         - exposes a `smallSpend` shortcut for sub-threshold amounts,
///         - runs a propose / approve / execute governance loop above the threshold.
///
/// @dev    Members deposit by bundling `Hub.groupMint` + `Hub.safeTransferFrom` to
///         this contract in a single Safe execution. On receipt the contract
///         credits `deposited[from] += value`. The pot's token id is locked in at
///         construction time from the linked group avatar.
contract KittyGovernance is IERC1155Receiver, IERC165 {
    address public immutable hub;
    address public immutable groupAvatar;
    uint256 public immutable potTokenId;

    uint8 public immutable quorumPercent;
    uint128 public immutable smallTxThreshold;
    uint32 public immutable votingPeriod;

    address[] private _members;
    mapping(address => bool) public isMember;

    /// Raw amounts each member has transferred in. Used for redemption (Phase 3).
    mapping(address => uint128) public deposited;
    uint128 public totalDeposited;

    struct Proposal {
        address proposer;
        address recipient;
        uint128 amount;
        uint32 deadline;
        uint32 approvals;
        bool executed;
        string memo;
    }

    Proposal[] private _proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event KittyInitialized(address indexed group, address[] members);
    event Deposit(address indexed from, uint128 amount, uint128 newTotal);
    event Proposed(
        uint256 indexed id,
        address indexed proposer,
        address recipient,
        uint128 amount,
        string memo
    );
    event Approved(uint256 indexed id, address indexed voter, uint32 approvals);
    event Executed(uint256 indexed id, address recipient, uint128 amount);
    event SmallSpend(address indexed by, address recipient, uint128 amount, string memo);

    error NotMember();
    error BadQuorum();
    error NotEnoughMembers();
    error DuplicateMember();
    error AmountExceedsThreshold();
    error AlreadyExecuted();
    error AlreadyVoted();
    error VotingClosed();
    error QuorumNotReached();
    error UnknownProposal();
    error OnlyHub();
    error WrongTokenId();

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    constructor(
        address _hub,
        address _groupAvatar,
        address[] memory members_,
        uint8 _quorumPercent,
        uint128 _smallTxThreshold,
        uint32 _votingPeriod
    ) {
        if (_quorumPercent == 0 || _quorumPercent > 100) revert BadQuorum();
        if (members_.length < 2) revert NotEnoughMembers();

        hub = _hub;
        groupAvatar = _groupAvatar;
        potTokenId = IHub(_hub).toTokenId(_groupAvatar);
        quorumPercent = _quorumPercent;
        smallTxThreshold = _smallTxThreshold;
        votingPeriod = _votingPeriod;

        for (uint256 i = 0; i < members_.length; i++) {
            address m = members_[i];
            if (isMember[m]) revert DuplicateMember();
            isMember[m] = true;
            _members.push(m);
        }

        emit KittyInitialized(_groupAvatar, members_);
    }

    // ── ERC-1155 receiver ───────────────────────────────────────────────────

    function onERC1155Received(
        address /* operator */,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        if (msg.sender != hub) revert OnlyHub();
        if (id != potTokenId) revert WrongTokenId();
        _credit(from, uint128(value));
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address /* operator */,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        if (msg.sender != hub) revert OnlyHub();
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            if (ids[i] != potTokenId) revert WrongTokenId();
            _credit(from, uint128(values[i]));
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    function _credit(address from, uint128 amount) internal {
        deposited[from] += amount;
        totalDeposited += amount;
        emit Deposit(from, amount, totalDeposited);
    }

    // ── spending ────────────────────────────────────────────────────────────

    /// @notice Spend below the small-tx threshold without a vote.
    function smallSpend(
        address recipient,
        uint128 amount,
        string calldata memo
    ) external onlyMember {
        if (amount > smallTxThreshold) revert AmountExceedsThreshold();
        _transferOut(recipient, amount);
        emit SmallSpend(msg.sender, recipient, amount, memo);
    }

    /// @notice Open a proposal for a larger spend. The proposer's vote is counted.
    function propose(
        address recipient,
        uint128 amount,
        string calldata memo
    ) external onlyMember returns (uint256 id) {
        id = _proposals.length;
        _proposals.push(
            Proposal({
                proposer: msg.sender,
                recipient: recipient,
                amount: amount,
                deadline: uint32(block.timestamp) + votingPeriod,
                approvals: 1,
                executed: false,
                memo: memo
            })
        );
        hasVoted[id][msg.sender] = true;
        emit Proposed(id, msg.sender, recipient, amount, memo);
        emit Approved(id, msg.sender, 1);
    }

    /// @notice Approve a pending proposal. Does NOT auto-execute — see `execute`.
    ///         Front-ends should bundle `[approve, execute]` when the next vote
    ///         meets quorum, so vote-recording stays decoupled from transfer
    ///         success.
    function approve(uint256 id) external onlyMember {
        if (id >= _proposals.length) revert UnknownProposal();
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (block.timestamp > p.deadline) revert VotingClosed();
        if (hasVoted[id][msg.sender]) revert AlreadyVoted();

        hasVoted[id][msg.sender] = true;
        p.approvals += 1;
        emit Approved(id, msg.sender, p.approvals);
    }

    /// @notice Settle a proposal once it has reached quorum.
    function execute(uint256 id) external onlyMember {
        if (id >= _proposals.length) revert UnknownProposal();
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (!_quorumReached(p.approvals)) revert QuorumNotReached();
        p.executed = true;
        _transferOut(p.recipient, p.amount);
        emit Executed(id, p.recipient, p.amount);
    }

    /// @dev Transfers pot tokens out of THIS contract (the custodian), not the group.
    function _transferOut(address recipient, uint128 amount) internal {
        IHub(hub).safeTransferFrom(address(this), recipient, potTokenId, amount, "");
    }

    function _quorumReached(uint32 approvals) internal view returns (bool) {
        return uint256(approvals) * 100 >= _members.length * quorumPercent;
    }

    // ── views ───────────────────────────────────────────────────────────────

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function getMembers() external view returns (address[] memory) {
        return _members;
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        if (id >= _proposals.length) revert UnknownProposal();
        return _proposals[id];
    }
}
