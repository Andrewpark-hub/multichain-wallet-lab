// 실습 1 - Step 4: EIP-712 구조화 서명 (ERC-2612 Permit)
// 트랜잭션이 아닌 '서명'만으로도 토큰 사용 권한이 넘어간다는 것을 확인한다.
// digest를 직접 조립해 보고, 서명에서 서명자를 다시 복원(ecrecover)해 본다.

const { ethers } = require('ethers');
require('dotenv').config({ quiet: true });

const chain_id = 11155111;
const token_address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';   // Sepolia USDC
const evm_path = "m/44'/60'/0'/0/0";
const demo_mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function main() {
    console.log("========================================");
    console.log("실습 1 - Step 4: EIP-712 구조화 서명");
    console.log("========================================\n");

    // 서명만 하는 실습이라 네트워크 연결이 필요 없다. .env가 없으면 데모 니모닉을 쓴다.
    const mnemonic = process.env.MNEMONIC ? process.env.MNEMONIC.trim() : demo_mnemonic;
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', evm_path);
    const spender = process.env.SPENDER_ADDRESS || '0x1111111111111111111111111111111111111111';

    // 1. 서명할 데이터 정의 (domain + types + value)
    // domain에 chainId와 컨트랙트 주소가 들어가므로, 다른 체인에서는 이 서명이 재사용되지 않는다.
    const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: chain_id,
        verifyingContract: token_address
    };
    const types = {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
        ]
    };
    const message = {
        owner: wallet.address,
        spender: ethers.getAddress(spender),
        value: ethers.MaxUint256,   // 무한 승인. 피싱에서 가장 많이 쓰이는 값이다.
        nonce: 0n,
        deadline: 2n ** 48n
    };

    console.log(`[*] 서명자(owner): ${message.owner}`);
    console.log(`[*] 권한을 받는 주소(spender): ${message.spender}`);
    console.log(`[*] 승인 금액(value): ${message.value}`);
    console.log("    -> MaxUint256 = 잔고 전액을 언제든 가져갈 수 있는 무한 승인");

    // 2. digest 구성 요소 확인
    // 최종 digest = keccak256(0x1901 || domainSeparator || hashStruct(message))
    const domain_separator = ethers.TypedDataEncoder.hashDomain(domain);
    const struct_hash = ethers.TypedDataEncoder.hashStruct('Permit', types, message);
    const digest = ethers.TypedDataEncoder.hash(domain, types, message);
    const manual_digest = ethers.keccak256(ethers.concat(['0x1901', domain_separator, struct_hash]));

    console.log(`\n[*] domainSeparator: ${domain_separator}`);
    console.log(`[*] hashStruct(message): ${struct_hash}`);
    console.log(`[*] digest: ${digest}`);
    console.log(`[*] 직접 조립한 digest와 일치: ${digest === manual_digest}`);

    // 3. 개인키로 서명하고 v / r / s 로 분해
    const signature = await wallet.signTypedData(domain, types, message);
    const parsed = ethers.Signature.from(signature);

    console.log(`\n[*] 서명값: ${signature}`);
    console.log(`[*] v: ${parsed.v}`);
    console.log(`[*] r: ${parsed.r}`);
    console.log(`[*] s: ${parsed.s}`);

    // 4. 서명에서 서명자 복원 (컨트랙트가 ecrecover로 하는 일과 같다)
    const recovered = ethers.verifyTypedData(domain, types, message, signature);
    console.log(`\n[*] 서명에서 복원한 주소: ${recovered}`);
    console.log(`[*] 원래 서명자와 일치: ${recovered === wallet.address}`);

    console.log("\n[참고] 컨트랙트는 digest와 v/r/s만 가지고 서명자를 복원한다.");
    console.log("       개인키를 넘기지 않아도 권한이 넘어가고, 가스도 들지 않아서 피싱에 자주 쓰인다.");
    console.log("       지갑에서 서명 요청 창이 뜨면 spender와 value를 반드시 확인할 것.");
}

main();
