// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.24;

/// @title  ServiceRegistry (v2)
/// @notice Singleton registry where Circles humans publish small services
///         (haircut, coaching, freelance hours, brunch in their flat) priced
///         in CRC. Read for free, anyone in the trust graph can pay via a
///         separate Hub.safeTransferFrom + this contract's logPayment in a
///         single bundled signature.
///
/// @dev    The contract holds no funds. CRC moves on the Hub via
///         safeTransferFrom from the buyer to the provider. logPayment
///         records the trace so the front can render stats ("3 cuts paid
///         via the Kitty") without scanning every Hub transfer.
///
///         **v2 adds an opt-in `poolShareBps` per service**: the provider
///         chooses 0–20% (in basis points) of every payment they want
///         redirected to a community pool. The contract only stores the
///         declared share — the actual split is computed by the front and
///         bundled as a second `Hub.safeTransferFrom` to the pool address
///         in the same signature. Keeping the pool target off-chain at v1
///         lets us migrate from a Safe-managed pool to a future
///         `RewardPool.sol` contract without redeploying the registry.
///
///         Active state is enforced for `update` only — `logPayment` always
///         accepts so a stale UI race never strands a buyer who already
///         paid on the Hub.
contract ServiceRegistry {
    /// @notice UI-side soft limits documented as on-chain constants so
    ///         clients have a single source of truth.
    uint256 public constant MAX_TITLE_LEN = 64;
    uint256 public constant MAX_DESCRIPTION_LEN = 256;
    uint256 public constant MAX_MEMO_LEN = 256;
    /// @notice Hard cap on the opt-in community pool share. 10000 = 100%
    ///         (v3 bump from v2's 2000 = 20%). A provider can now run a
    ///         pure-fundraiser service that routes the whole payment to
    ///         the community pool. The 100% case is signposted in the
    ///         publish UI ("⚠️ you keep 0 CRC") so providers don't trip
    ///         into it accidentally — the contract itself just enforces
    ///         the protocol-level ceiling.
    uint16 public constant MAX_POOL_SHARE_BPS = 10000;

    struct Service {
        uint64 id;
        address provider;
        string title;
        string description;
        uint128 priceCrc;
        uint32 durationMins;
        bool active;
        uint64 createdAt;
        /// @notice Basis points (0..MAX_POOL_SHARE_BPS) of every payment
        ///         the provider wants routed to the community pool. The
        ///         contract does not enforce the routing — the front
        ///         bundles the second transfer.
        uint16 poolShareBps;
    }

    Service[] private _services;
    mapping(address => uint64[]) private _byProvider;

    /// @notice Cumulative count of payments logged for this service.
    mapping(uint64 => uint128) public timesPaid;
    /// @notice Cumulative CRC paid (raw uint128 units).
    mapping(uint64 => uint128) public totalPaid;

    /// @notice Sum of all star ratings for this service. Average is
    ///         `ratingsSum[id] / ratingsCount[id]`. Front computes the
    ///         display value (e.g. 4.2/5 with one decimal).
    mapping(uint64 => uint128) public ratingsSum;
    /// @notice Distinct raters per service. Used as the denominator for
    ///         the average rating.
    mapping(uint64 => uint64) public ratingsCount;
    /// @notice Per-rater previous rating (1..5). 0 means "never rated".
    ///         Stored so we can rewrite ratingsSum cleanly when someone
    ///         changes their mind without double-counting.
    mapping(uint64 => mapping(address => uint8)) public ratingBy;

    event ServicePublished(
        uint64 indexed id,
        address indexed provider,
        string title,
        uint128 priceCrc,
        uint32 durationMins,
        uint16 poolShareBps
    );
    event ServiceUpdated(
        uint64 indexed id,
        address indexed provider,
        string title,
        uint128 priceCrc,
        uint32 durationMins,
        uint16 poolShareBps
    );
    event ServiceDeactivated(uint64 indexed id, address indexed provider);
    event ServicePaid(
        uint64 indexed id,
        address indexed provider,
        address indexed buyer,
        uint128 amount,
        string memo
    );
    event ServiceRated(
        uint64 indexed id,
        address indexed rater,
        uint8 stars,
        uint64 ratingsCount,
        uint128 ratingsSum
    );

    error NotProvider();
    error ServiceNotFound();
    error ServiceInactive();
    error EmptyTitle();
    error TitleTooLong();
    error DescriptionTooLong();
    error MemoTooLong();
    error BadRating();
    error PoolShareTooHigh();

    // ── write ───────────────────────────────────────────────────────────────

    function publish(
        string calldata title,
        string calldata description,
        uint128 priceCrc,
        uint32 durationMins,
        uint16 poolShareBps
    ) external returns (uint64 id) {
        uint256 titleLen = bytes(title).length;
        if (titleLen == 0) revert EmptyTitle();
        if (titleLen > MAX_TITLE_LEN) revert TitleTooLong();
        if (bytes(description).length > MAX_DESCRIPTION_LEN) revert DescriptionTooLong();
        if (poolShareBps > MAX_POOL_SHARE_BPS) revert PoolShareTooHigh();

        id = uint64(_services.length);
        _services.push(
            Service({
                id: id,
                provider: msg.sender,
                title: title,
                description: description,
                priceCrc: priceCrc,
                durationMins: durationMins,
                active: true,
                createdAt: uint64(block.timestamp),
                poolShareBps: poolShareBps
            })
        );
        _byProvider[msg.sender].push(id);
        emit ServicePublished(id, msg.sender, title, priceCrc, durationMins, poolShareBps);
    }

    function update(
        uint64 id,
        string calldata title,
        string calldata description,
        uint128 priceCrc,
        uint32 durationMins,
        uint16 poolShareBps
    ) external {
        if (id >= _services.length) revert ServiceNotFound();
        Service storage s = _services[id];
        if (s.provider != msg.sender) revert NotProvider();
        if (!s.active) revert ServiceInactive();

        uint256 titleLen = bytes(title).length;
        if (titleLen == 0) revert EmptyTitle();
        if (titleLen > MAX_TITLE_LEN) revert TitleTooLong();
        if (bytes(description).length > MAX_DESCRIPTION_LEN) revert DescriptionTooLong();
        if (poolShareBps > MAX_POOL_SHARE_BPS) revert PoolShareTooHigh();

        s.title = title;
        s.description = description;
        s.priceCrc = priceCrc;
        s.durationMins = durationMins;
        s.poolShareBps = poolShareBps;
        emit ServiceUpdated(id, msg.sender, title, priceCrc, durationMins, poolShareBps);
    }

    function deactivate(uint64 id) external {
        if (id >= _services.length) revert ServiceNotFound();
        Service storage s = _services[id];
        if (s.provider != msg.sender) revert NotProvider();
        s.active = false;
        emit ServiceDeactivated(id, msg.sender);
    }

    /// @notice Record a payment for stats. Anyone can call (the front bundles
    ///         it after a real Hub.safeTransferFrom in the same tx). The
    ///         contract does not verify the CRC actually moved — the trace
    ///         is advisory. `amount` is the full price the buyer paid
    ///         (before any community-pool split), so aggregate counters
    ///         reflect the headline number, not the provider's net cut.
    function logPayment(uint64 id, uint128 amount, string calldata memo) external {
        if (id >= _services.length) revert ServiceNotFound();
        if (bytes(memo).length > MAX_MEMO_LEN) revert MemoTooLong();
        Service memory s = _services[id];
        timesPaid[id] += 1;
        totalPaid[id] += amount;
        emit ServicePaid(id, s.provider, msg.sender, amount, memo);
    }

    /// @notice Rate a service 1..5 stars. Each rater holds one slot per
    ///         service; calling rate again overwrites the previous score
    ///         (and updates the aggregate cleanly). Anyone can rate — V1
    ///         relies on the trust graph + the social cost of rating
    ///         someone you didn't actually buy from. V2 could gate on
    ///         "has logged a payment for this service" but that adds an
    ///         attack surface (force-log to gate rating).
    function rate(uint64 id, uint8 stars) external {
        if (id >= _services.length) revert ServiceNotFound();
        if (stars == 0 || stars > 5) revert BadRating();

        uint8 previous = ratingBy[id][msg.sender];
        if (previous == 0) {
            ratingsCount[id] += 1;
            ratingsSum[id] += stars;
        } else {
            // Update in place: subtract the old, add the new.
            ratingsSum[id] = ratingsSum[id] - previous + stars;
        }
        ratingBy[id][msg.sender] = stars;
        emit ServiceRated(id, msg.sender, stars, ratingsCount[id], ratingsSum[id]);
    }

    // ── views ───────────────────────────────────────────────────────────────

    function serviceCount() external view returns (uint256) {
        return _services.length;
    }

    function getService(uint64 id) external view returns (Service memory) {
        if (id >= _services.length) revert ServiceNotFound();
        return _services[id];
    }

    function servicesByProvider(address provider) external view returns (Service[] memory out) {
        uint64[] storage ids = _byProvider[provider];
        out = new Service[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            out[i] = _services[ids[i]];
        }
    }

    function serviceIdsByProvider(address provider) external view returns (uint64[] memory) {
        return _byProvider[provider];
    }

    /// @notice Returns only the active services for `provider` — handy for
    ///         the kitty detail page which doesn't want to render archived
    ///         entries.
    function activeServicesByProvider(address provider) external view returns (Service[] memory out) {
        uint64[] storage ids = _byProvider[provider];
        uint256 activeCount;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_services[ids[i]].active) activeCount++;
        }
        out = new Service[](activeCount);
        uint256 j;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_services[ids[i]].active) {
                out[j++] = _services[ids[i]];
            }
        }
    }
}
