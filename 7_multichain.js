// 실습 1 - Step 7: 같은 니모닉, 다른 체인 (Sui / Solana)
// 니모닉 하나가 곡선(curve)과 파생 경로에 따라 완전히 다른 주소가 되는 것을 확인한다.
//   - EVM: secp256k1 + keccak256 마지막 20바이트
//   - Sui: ed25519 + blake2b-256
//   - Solana: ed25519 + base58

const bip39 = require('bip39');
const { ethers } = require('ethers');
const { derivePath } = require('ed25519-hd-key');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { SuiGrpcClient } = require('@mysten/sui/grpc');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config({ quiet: true });

const demo_mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const evm_path = "m/44'/60'/0'/0/0";
const sui_path = "m/44'/784'/0'/0'/0'";
const sol_path = "m/44'/501'/0'/0'";
const mist_per_sui = 1000000000;

async function main() {
    console.log("========================================");
    console.log("실습 1 - Step 7: 같은 니모닉, 다른 체인");
    console.log("========================================\n");

    const mnemonic = process.env.MNEMONIC ? process.env.MNEMONIC.trim() : demo_mnemonic;
    const seed = bip39.mnemonicToSeedSync(mnemonic, '');

    // 1. 체인별 주소 파생
    // EVM은 일반 파생이 가능하지만, ed25519 계열은 hardened 파생만 가능해서 경로 끝까지 '가 붙는다.
    const evm = ethers.HDNodeWallet.fromPhrase(mnemonic, '', evm_path);
    const sui = Ed25519Keypair.deriveKeypair(mnemonic, sui_path);
    const solana = Keypair.fromSeed(derivePath(sol_path, seed.toString('hex')).key);

    console.log("[*] EVM (secp256k1)");
    console.log(`    경로: ${evm_path}`);
    console.log(`    주소: ${evm.address}`);
    console.log("[*] Sui (ed25519)");
    console.log(`    경로: ${sui_path}`);
    console.log(`    주소: ${sui.getPublicKey().toSuiAddress()}`);
    console.log("[*] Solana (ed25519)");
    console.log(`    경로: ${sol_path}`);
    console.log(`    주소: ${solana.publicKey.toBase58()}`);
    console.log("\n    -> 같은 니모닉이지만 곡선과 인코딩이 달라 주소가 전혀 다르다.");
    console.log("       반대로 Ethereum / Base 같은 EVM 계열끼리는 chainId만 다르고 주소는 같다.");

    // 2. Sui 테스트넷 조회
    // 메모: Sui 공식 퍼블릭 풀노드는 JSON-RPC를 종료했다(-32601 Method not found).
    //       그래서 SuiClient 대신 gRPC 클라이언트를 쓴다. 옵션 키가 url이 아니라 baseUrl인 점 주의.
    console.log("\n----------------------------------------");
    console.log("Sui Testnet 조회");
    console.log("----------------------------------------");
    try {
        const sui_client = new SuiGrpcClient({
            network: 'testnet',
            baseUrl: process.env.SUI_GRPC_URL || 'https://fullnode.testnet.sui.io:443'
        });
        const { balances } = await sui_client.core.getAllBalances({ address: sui.getPublicKey().toSuiAddress() });
        if (balances.length === 0) {
            console.log("[*] 보유 코인 없음. https://faucet.sui.io 에서 테스트넷 SUI를 받으세요.");
        } else {
            balances.forEach(item => {
                console.log(`[*] ${item.coinType}: ${Number(item.balance) / mist_per_sui}`);
            });
        }
        console.log("[참고] EVM은 계정 하나에 잔고 숫자가 붙지만, Sui는 코인을 '오브젝트'로 소유한다.");
    } catch (e) {
        console.log(`[!] 조회 실패: ${e.message}`);
    }

    // 3. Solana devnet 조회
    console.log("\n----------------------------------------");
    console.log("Solana Devnet 조회");
    console.log("----------------------------------------");
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
        const lamports = await connection.getBalance(new PublicKey(solana.publicKey.toBase58()));
        console.log(`[*] 잔고: ${lamports} lamports (${lamports / LAMPORTS_PER_SOL} SOL)`);
        if (lamports === 0) {
            console.log("[*] 잔고가 없습니다. https://faucet.solana.com 에서 받으세요.");
        }
        console.log(`[*] 탐색기: https://explorer.solana.com/address/${solana.publicKey.toBase58()}?cluster=devnet`);
    } catch (e) {
        console.log(`[!] 조회 실패: ${e.message}`);
    }

    console.log("\n[참고] 니모닉 하나 = 지갑 하나가 아니라, 니모닉 하나 = 체인별 주소 트리 하나로 이해해야 한다.");
}

main();
