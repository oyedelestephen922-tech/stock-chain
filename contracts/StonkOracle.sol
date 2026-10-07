// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title StonkOracle
 * @notice Chainlink price feed aggregator with 26-hour staleness safety
 * and owner overrides for tokenized equities on Robinhood Chain.
 */

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

contract StonkOracle {
    address public owner;
    uint256 public constant MAX_STALENESS = 26 hours;

    mapping(address => address) public feeds;
    mapping(address => uint256) public manualPrices;
    mapping(address => bool) public useManualPrice;

    event OwnerUpdated(address indexed prevOwner, address indexed newOwner);
    event FeedSet(address indexed token, address indexed feed);
    event ManualPriceSet(address indexed token, uint256 price, bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnerUpdated(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    function setFeed(address token, address feed) external onlyOwner {
        require(token != address(0), "INVALID_TOKEN");
        feeds[token] = feed;
        emit FeedSet(token, feed);
    }

    function setManualPrice(address token, uint256 price, bool enabled) external onlyOwner {
        require(token != address(0), "INVALID_TOKEN");
        manualPrices[token] = price;
        useManualPrice[token] = enabled;
        emit ManualPriceSet(token, price, enabled);
    }

    /**
     * @notice Returns price normalized with decimals (default 8 decimals for Chainlink USD feeds)
     */
    function getPrice(address token) external view returns (uint256 price, uint8 decimals) {
        if (useManualPrice[token]) {
            return (manualPrices[token], 8);
        }

        address feed = feeds[token];
        require(feed != address(0), "NO_FEED_CONFIGURED");

        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
            
        ) = AggregatorV3Interface(feed).latestRoundData();

        require(answer > 0, "INVALID_ORACLE_PRICE");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "STALE_ORACLE_PRICE");

        decimals = AggregatorV3Interface(feed).decimals();
        price = uint256(answer);
    }
}
