// 실습 1 - Step 2: 온체인 조회 (잔고 / 블록 / 가스 / ERC-20)
// 같은 지갑 코드가 RPC와 chainId만 바꿔도 그대로 동작하는지 확인한다.
// 여기까지는 전부 읽기 전용이라 가스가 들지 않는다.

const fs = require('fs');
const { ethers } = require('ethers');
require('dotenv').config({ quiet: true });

// 조회할 EVM 테스트넷 목록
const chains = [
    {
        name: 'Ethereum Sepolia',
        chain_id: 11155111,
        rpc: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
        explorer: 'https://sepolia.etherscan.io',
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'   // 테스트넷 USDC
    },
    {
        name: 'Base Sepolia',
        chain_id: 84532,
        rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
        explorer: 'https://sepolia.basescan.org',
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    }
];

// ERC-20에서 조회에 쓰는 함수만 추려낸 ABI
const erc20_abi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)'
];

async function main() {
    console.log("========================================");
    console.log("실습 1 - Step 2: 온체인 조회");
    console.log("========================================\n");

    // 이전 단계 데이터 로드
    let address;
    try {
        address = JSON.parse(fs.readFileSync('shared_data.json', 'utf8')).address;
    } catch (e) {
        console.log("[오류] shared_data.json 파일을 찾을 수 없습니다. ./run.sh 1 을 먼저 실행하세요.");
        return;
    }
    console.log(`[*] 조회 대상 주소: ${address}\n`);

    for (const chain of chains) {
        const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chain_id);

        console.log("----------------------------------------");
        console.log(`${chain.name}`);
        console.log("----------------------------------------");

        try {
            // 1. 네트워크 기본 정보와 잔고 조회
            const network = await provider.getNetwork();
            const block = await provider.getBlockNumber();
            const balance = await provider.getBalance(address);
            const fee = await provider.getFeeData();

            console.log(`[*] chainId: ${network.chainId} (기대값 ${chain.chain_id})`);
            console.log(`[*] 최신 블록 번호: ${block}`);
            console.log(`[*] 네이티브 잔고: ${ethers.formatEther(balance)} ETH`);
            console.log(`[*] maxFeePerGas: ${ethers.formatUnits(fee.maxFeePerGas, 'gwei')} gwei`);

            // 2. ERC-20 컨트랙트 read (토큰 잔고는 컨트랙트가 관리하는 장부다)
            const token = new ethers.Contract(chain.token, erc20_abi, provider);
            const name = await token.name();
            const symbol = await token.symbol();
            const decimals = await token.decimals();
            const supply = await token.totalSupply();
            const token_balance = await token.balanceOf(address);

            console.log(`[*] 토큰: ${name} (${symbol}), decimals ${decimals}`);
            console.log(`[*] 총 발행량: ${ethers.formatUnits(supply, decimals)} ${symbol}`);
            console.log(`[*] 내 토큰 잔고: ${ethers.formatUnits(token_balance, decimals)} ${symbol}`);
            console.log(`[*] 탐색기: ${chain.explorer}/address/${address}`);
        } catch (e) {
            console.log(`[오류] 조회 실패: ${e.shortMessage || e.message}`);
        }
        console.log("");
    }

    console.log("[참고] 잔고와 컨트랙트 조회는 RPC만으로 되지만,");
    console.log("       '내가 가진 토큰 전체 목록'이나 '거래 내역'은 RPC에 없어서 Indexer가 필요하다.");
}

main();
