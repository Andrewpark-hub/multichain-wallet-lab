#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STEP="${1:-1}"
cd "$SCRIPT_DIR" || exit 1

case "$STEP" in
  1)
    echo "=== [Step 1] Key Derivation (니모닉 생성과 키 파생) ==="
    node 1_key_derivation.js
    ;;
  2)
    echo "=== [Step 2] On-chain Read (잔고 / ERC-20 조회) ==="
    node 2_onchain_read.js
    ;;
  3)
    echo "=== [Step 3] Send Transaction (트랜잭션 서명과 전송) ==="
    node 3_send_transaction.js
    ;;
  4)
    echo "=== [Step 4] EIP-712 Signature (구조화 서명) ==="
    node 4_sign_eip712.js
    ;;
  5)
    echo "=== [Step 5] Approve / Revoke (토큰 승인과 회수) ==="
    node 5_approve_token.js
    ;;
  6)
    echo "=== [Step 6] Allowance Audit (승인 감사) ==="
    node 6_allowance_audit.js
    ;;
  7)
    echo "=== [Step 7] Multichain (Sui / Solana) ==="
    node 7_multichain.js
    ;;
  *)
    echo "사용법: ./run.sh [1|2|3|4|5|6|7]"
    exit 1
    ;;
esac
