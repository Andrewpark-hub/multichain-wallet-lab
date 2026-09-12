// 실습 1 - Step 6: 승인 감사 (내 지갑이 누구에게 권한을 줬는가)
// Approval 이벤트 로그를 블록 구간별로 스캔해서 spender 목록을 모으고,
// 각 spender에 대해 '지금 살아있는' allowance를 다시 조회한다.
// 읽기 전용이라 개인키가 필요 없다.

const fs = require('fs');
const { ethers } = require('ethers');
require('dotenv').config({ quiet: true });

const rpc_url = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const chain_id = 11155111;
const explorer = 'https://sepolia.etherscan.io';
const token_address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

// 공개 RPC는 한 번에 조회할 수 있는 블록 범위를 제한한다. 그래서 잘라서 돌아야 한다.
const lookback_blocks = Number(process.env.LOOKBACK_BLOCKS || 100000);
const chunk_size = Number(process.env.LOG_CHUNK || 9000);

// 무한 승인 판별 기준. approve 할 때 보통 uint256 최댓값을 넣는다.
const unlimited_threshold = ethers.MaxUint256;

const erc20_abi = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

async function main() {
    console.log("========================================");
    console.log("실습 1 - Step 6: 승인(approve) 감사");
    console.log("========================================\n");

    // 감사할 주소: OWNER_ADDRESS > shared_data.json 순서로 찾는다.
    let owner = process.env.OWNER_ADDRESS;
    if (!owner) {
        try {
            owner = JSON.parse(fs.readFileSync('shared_data.json', 'utf8')).address;
        } catch (e) {
            console.log("[오류] 감사할 주소가 없습니다. ./run.sh 1 을 먼저 실행하거나 OWNER_ADDRESS를 지정하세요.");
            return;
        }
    }
    owner = ethers.getAddress(owner);

    const provider = new ethers.JsonRpcProvider(rpc_url, chain_id);
    const token = new ethers.Contract(token_address, erc20_abi, provider);
    const symbol = await token.symbol();
    const decimals = await token.decimals();

    const latest = await provider.getBlockNumber();
    const start = Math.max(0, latest - lookback_blocks);

    console.log(`[*] 감사 대상 주소: ${owner}`);
    console.log(`[*] 토큰: ${token_address} (${symbol})`);
    console.log(`[*] 조회 구간: ${start} ~ ${latest} 블록 (${chunk_size} 블록씩)\n`);

    // 1. Approval 로그 스캔 - owner가 나인 것만 필터링해서 spender를 모은다.
    const filter = token.filters.Approval(owner, null);
    const spenders = new Map();   // spender -> 마지막으로 승인한 블록 번호

    for (let from = start; from <= latest; from += chunk_size) {
        const to = Math.min(from + chunk_size - 1, latest);
        try {
            const logs = await token.queryFilter(filter, from, to);
            logs.forEach(log => spenders.set(ethers.getAddress(log.args.spender), log.blockNumber));
        } catch (e) {
            console.log(`[!] ${from}~${to} 블록 조회 실패 (LOG_CHUNK를 줄여보세요)`);
        }
    }
    console.log(`[*] 발견된 spender 수: ${spenders.size}`);

    if (spenders.size === 0) {
        console.log("\n[완료] 이 구간에는 Approval 로그가 없습니다. ./run.sh 5 로 승인을 하나 만든 뒤 다시 실행해 보세요.");
        return;
    }

    // 2. 로그에 찍힌 과거 금액이 아니라, 지금 살아있는 allowance를 다시 조회한다.
    console.log("\n[*] 현재 살아있는 권한");
    let unlimited = [];
    for (const [spender, block] of spenders) {
        const allowance = await token.allowance(owner, spender);
        let status;
        if (allowance === 0n) {
            status = '없음 (이미 회수됨)';
        } else if (allowance >= unlimited_threshold) {
            status = '무한 승인 - 위험';
            unlimited.push(spender);
        } else {
            status = `${ethers.formatUnits(allowance, decimals)} ${symbol}`;
        }
        console.log(`    ${spender}  (블록 ${block})  ->  ${status}`);
    }

    // 3. 위험한 승인이 있으면 회수 명령어를 안내한다.
    if (unlimited.length > 0) {
        console.log("\n[!] 회수가 필요한 무한 승인이 있습니다.");
        unlimited.forEach(spender => {
            console.log(`    SPENDER_ADDRESS=${spender} TOKEN_AMOUNT=0 SEND_TX=true ./run.sh 5`);
        });
    } else {
        console.log("\n[*] 무한 승인은 없습니다.");
    }

    console.log(`\n[참고] 탐색기에서도 확인 가능: ${explorer}/tokenapprovalchecker`);
    console.log("       이 스크립트는 토큰 1개만 본다. 실제 감사는 보유 토큰 목록부터 Indexer로 받아와야 한다.");
    console.log("       로그를 구간별로 잘라 도는 이 작업이 곧 Indexer가 대신 해주는 일이다.");
}

main();
