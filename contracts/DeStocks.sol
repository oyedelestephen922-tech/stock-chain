// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title DeStocks
 * @notice Fully collateralised weekly options on Robinhood Stock Tokens.
 * Features covered calls (lock tokens) and cash-secured puts (lock USDG),
 * settled via Chainlink price feeds, with long positions minted as ERC-1155.
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

contract DeStocks {
    address public immutable usdg; // 6 decimals
    address public feeRecipient;
    address public owner;

    uint256 public feeBps = 200; // 2% of premium
    uint256 public constant MAX_FEE_BPS = 500; // 5% hard cap
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant FEED_MAX_AGE = 27 hours;
    uint256 public constant EXERCISE_WINDOW = 72 hours;

    struct Market {
        address token; // Equity token (18 decimals)
        address feed;  // Chainlink feed
        bool active;
    }

    struct Offer {
        uint32 marketId;
        bool isCall;
        uint256 strike;          // 8 decimals (matches Chainlink feed)
        uint256 expiry;          // Unix timestamp (Friday 20:00 UTC)
        uint256 amount;          // 18 decimals
        uint256 remainingAmount; // 18 decimals
        uint256 premiumPerUnit;  // USDG (6 decimals per 1e18 contract)
        address writer;
        bool cancelled;
    }

    struct Series {
        uint32 marketId;
        bool isCall;
        uint256 strike;
        uint256 expiry;
        uint256 settledPrice;
        bool settled;
        uint256 totalCollateralLocked;
    }

    mapping(uint32 => Market) public markets;
    uint32 public marketCount;

    mapping(uint256 => Offer) public offers;
    uint256 public offerCount;

    mapping(uint256 => Series) public series;
    mapping(uint256 => mapping(address => uint256)) public balanceOf; // ERC-1155 long balances

    event MarketAdded(uint32 indexed marketId, address indexed token, address indexed feed);
    event Written(uint256 indexed offerId, address indexed writer, uint32 marketId, bool isCall, uint256 strike, uint256 amount, uint256 premium);
    event Filled(uint256 indexed offerId, address indexed buyer, uint256 amount, uint256 totalPremium);
    event Settled(uint256 indexed seriesId, uint256 price);
    event Claimed(uint256 indexed seriesId, address indexed buyer, uint256 payout);
    event Reclaimed(uint256 indexed offerId, address indexed writer, uint256 amount);
    event Cancelled(uint256 indexed offerId);
    event FeeUpdated(uint256 newFeeBps, address newRecipient);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address usdg_, address feeRecipient_, address owner_) {
        require(usdg_ != address(0), "INVALID_USDG");
        usdg = usdg_;
        feeRecipient = feeRecipient_ != address(0) ? feeRecipient_ : msg.sender;
        owner = owner_ != address(0) ? owner_ : msg.sender;
    }

    function addMarket(address token, address feed) external onlyOwner returns (uint32 id) {
        require(token != address(0) && feed != address(0), "INVALID_MARKET");
        id = ++marketCount;
        markets[id] = Market({token: token, feed: feed, active: true});
        emit MarketAdded(id, token, feed);
    }

    function setFee(uint256 newFeeBps, address newRecipient) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "FEE_TOO_HIGH");
        require(newRecipient != address(0), "INVALID_RECIPIENT");
        feeBps = newFeeBps;
        feeRecipient = newRecipient;
        emit FeeUpdated(newFeeBps, newRecipient);
    }

    function seriesId(uint32 marketId, bool isCall, uint256 strike, uint256 expiry) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(marketId, isCall, strike, expiry)));
    }

    function spot(uint32 marketId) public view returns (uint256 price, uint256 updatedAt) {
        Market memory m = markets[marketId];
        require(m.active, "MARKET_INACTIVE");
        (, int256 ans, , uint256 upAt, ) = IAggregatorV3(m.feed).latestRoundData();
        require(ans > 0, "INVALID_PRICE");
        require(block.timestamp - upAt <= FEED_MAX_AGE, "STALE_FEED");
        return (uint256(ans), upAt);
    }

    /**
     * @notice Write a covered call (locks token) or cash-secured put (locks USDG)
     */
    function write(
        uint32 marketId,
        bool isCall,
        uint256 strike,
        uint256 expiry,
        uint256 amount,
        uint256 premiumPerUnit
    ) external returns (uint256 offerId) {
        require(markets[marketId].active, "MARKET_INACTIVE");
        require(expiry > block.timestamp, "EXPIRED");
        require(amount > 0, "ZERO_AMOUNT");

        if (isCall) {
            // Lock underlying equity tokens
            require(IERC20(markets[marketId].token).transferFrom(msg.sender, address(this), amount), "PULL_TOKEN_FAIL");
        } else {
            // Lock USDG: (strike * amount) / 1e18, strike has 8 decimals, USDG has 6 decimals
            uint256 requiredUSDG = (amount * strike) / 1e20; // 18 + 8 - 20 = 6 decimals
            require(IERC20(usdg).transferFrom(msg.sender, address(this), requiredUSDG), "PULL_USDG_FAIL");
        }

        offerId = ++offerCount;
        offers[offerId] = Offer({
            marketId: marketId,
            isCall: isCall,
            strike: strike,
            expiry: expiry,
            amount: amount,
            remainingAmount: amount,
            premiumPerUnit: premiumPerUnit,
            writer: msg.sender,
            cancelled: false
        });

        emit Written(offerId, msg.sender, marketId, isCall, strike, amount, premiumPerUnit);
    }

    /**
     * @notice Buy option from offer
     */
    function fill(uint256 offerId, uint256 fillAmount) external returns (uint256 sid) {
        Offer storage off = offers[offerId];
        require(!off.cancelled, "CANCELLED");
        require(off.expiry > block.timestamp, "EXPIRED");
        require(fillAmount > 0 && fillAmount <= off.remainingAmount, "INVALID_FILL_AMOUNT");

        off.remainingAmount -= fillAmount;

        // Premium: (fillAmount * premiumPerUnit) / 1e18 (USDG has 6 decimals)
        uint256 totalPremium = (fillAmount * off.premiumPerUnit) / 1e18;
        uint256 protocolFee = (totalPremium * feeBps) / BPS_DENOMINATOR;
        uint256 writerPremium = totalPremium - protocolFee;

        require(IERC20(usdg).transferFrom(msg.sender, address(this), totalPremium), "PULL_PREMIUM_FAIL");
        if (protocolFee > 0) {
            IERC20(usdg).transfer(feeRecipient, protocolFee);
        }
        IERC20(usdg).transfer(off.writer, writerPremium);

        // Mint long ERC-1155 tokens
        sid = seriesId(off.marketId, off.isCall, off.strike, off.expiry);
        Series storage s = series[sid];
        if (s.expiry == 0) {
            s.marketId = off.marketId;
            s.isCall = off.isCall;
            s.strike = off.strike;
            s.expiry = off.expiry;
        }
        s.totalCollateralLocked += fillAmount;
        balanceOf[sid][msg.sender] += fillAmount;

        emit Filled(offerId, msg.sender, fillAmount, totalPremium);
    }

    /**
     * @notice Settle option series via Chainlink feed at Friday 20:00 UTC
     */
    function settle(uint256 sid) external {
        Series storage s = series[sid];
        require(s.expiry > 0 && block.timestamp >= s.expiry, "NOT_EXPIRED");
        require(!s.settled, "ALREADY_SETTLED");

        (uint256 currentSpot, ) = spot(s.marketId);
        s.settledPrice = currentSpot;
        s.settled = true;

        emit Settled(sid, currentSpot);
    }

    /**
     * @notice Claim payout for an ITM long option
     */
    function claim(uint256 sid, uint256 shares) external returns (uint256 payout) {
        Series storage s = series[sid];
        require(s.settled, "NOT_SETTLED");
        require(balanceOf[sid][msg.sender] >= shares, "INSUFFICIENT_LONG");

        balanceOf[sid][msg.sender] -= shares;

        if (s.isCall) {
            if (s.settledPrice > s.strike) {
                // ITM: (P - K)/P tokens delivered
                payout = (shares * (s.settledPrice - s.strike)) / s.settledPrice;
                require(IERC20(markets[s.marketId].token).transfer(msg.sender, payout), "CALL_PAYOUT_FAIL");
            }
        } else {
            if (s.strike > s.settledPrice) {
                // ITM put: (K - P) USDG delivered
                payout = (shares * (s.strike - s.settledPrice)) / 1e20;
                require(IERC20(usdg).transfer(msg.sender, payout), "PUT_PAYOUT_FAIL");
            }
        }

        emit Claimed(sid, msg.sender, payout);
    }

    /**
     * @notice Writer reclaims remaining unfilled collateral
     */
    function reclaim(uint256 offerId) external {
        Offer storage off = offers[offerId];
        require(msg.sender == off.writer, "NOT_WRITER");
        require(off.remainingAmount > 0, "NO_COLLATERAL");
        require(off.cancelled || block.timestamp >= off.expiry, "OFFER_ACTIVE");

        uint256 amt = off.remainingAmount;
        off.remainingAmount = 0;

        if (off.isCall) {
            require(IERC20(markets[off.marketId].token).transfer(off.writer, amt), "RECLAIM_TOKEN_FAIL");
        } else {
            uint256 usdgAmt = (amt * off.strike) / 1e20;
            require(IERC20(usdg).transfer(off.writer, usdgAmt), "RECLAIM_USDG_FAIL");
        }

        emit Reclaimed(offerId, msg.sender, amt);
    }

    function cancel(uint256 offerId) external {
        Offer storage off = offers[offerId];
        require(msg.sender == off.writer, "NOT_WRITER");
        require(!off.cancelled, "ALREADY_CANCELLED");
        off.cancelled = true;
        emit Cancelled(offerId);
    }
}
