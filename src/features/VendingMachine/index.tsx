
import clsx from 'clsx';
import { observer } from 'mobx-react';
import useVendingMachine from './hooks/useVendingMachine';
import type { CashType } from './types';
import st from './style.module.scss';

/** 노출할 화폐 단위 버튼 목록 */
const AVAILABLE_CASH: CashType[] = [100, 500, 1000, 5000, 10000];

const VendingMachine = observer(() => {
  const { vendingMachine } = useVendingMachine();

  return (
    <div className={st.container}>
      <ul className={st.pannels}>
        <li className={clsx(st.panel)}>
          <h3 className={st.sectionTitle}>1) 결제</h3>

          <div className={st.row}>
            <button
              className={st.btn}
              disabled={vendingMachine.state !== 'Idle'}
              onClick={vendingMachine.startCashFlow}
            >
              현금 사용
            </button>
            <button
              className={st.btn}
              disabled={vendingMachine.state !== 'Idle'}
              onClick={vendingMachine.startCardFlow}
            >
              카드 사용
            </button>
            <button
              className={st.btn}
              disabled={!['AwaitingCash', 'CardReady'].includes(vendingMachine.state)}
              onClick={vendingMachine.cancelFlow}
            >
              취소
            </button>
          </div>

          {vendingMachine.state === 'AwaitingCash' && (
            <>
              <dl className={st.titleList}>
                <dt>투입금</dt><dd><b>{vendingMachine.insertedTotal.toLocaleString()}</b>원</dd>
                <dt>상태</dt><dd>현금 투입 중</dd>
              </dl>
              <div className={st.row}>
                {AVAILABLE_CASH.map((cash) => (
                  <button
                    key={cash}
                    className={st.btn}
                    onClick={() => vendingMachine.insertCash(cash)}
                  >
                    {cash.toLocaleString()}원 투입
                  </button>
                ))}
              </div>
            </>
          )}

          {vendingMachine.state === 'CardReady' && (
            <dl className={st.titleList}>
              <dt>결제수단</dt><dd>카드(승인 완료)</dd>
              <dt>상태</dt><dd>상품 선택 대기</dd>
            </dl>
          )}
        </li>

        <li className={clsx(st.panel)}>
          <h3 className={st.sectionTitle}>2) 상품</h3>
          <div className={st.items}>
            {Object.values(vendingMachine.context.drinks).map((drink) => {
              // 버튼 활성화 조건: 결제 준비 && 해당 상품을 살 수 있음 && 재고 있음
              const canPurchase =
                vendingMachine.isPaymentReady &&
                vendingMachine.canAfford(drink) &&
                drink.stock > 0;

              // 비활성 사유(텍스트로 노출)
              const disabledReason =
                !vendingMachine.isPaymentReady
                  ? '결제 수단을 먼저 선택하세요'
                  : drink.stock <= 0
                    ? '품절'
                    : !vendingMachine.canAfford(drink)
                      ? '금액 부족'
                      : '';

              return (
                <div key={drink.id} className={st.item}>
                  <div className={st.itemTop}>
                    <span className={st.itemName}>{drink.name}</span>
                    <span className={st.itemPrice}>{drink.price.toLocaleString()}원</span>
                  </div>
                  <div className={clsx(st.badge, drink.stock > 0 ? st.ok : st.err)}>
                    {drink.stock > 0 ? `재고 ${drink.stock}` : '품절'}
                  </div>
                  <button
                    type="button"
                    className={clsx(st.btn, canPurchase && st.primary)}
                    disabled={!canPurchase}
                    onClick={() => vendingMachine.purchaseDrinkNow(drink.id)}
                  >
                    {canPurchase ? '구매' : disabledReason}
                  </button>
                </div>
              );
            })}
          </div>
        </li>

        <li className={clsx(st.panel)}>
          <h3 className={st.sectionTitle}>관리자 화면</h3>

          <h4 className={st.sectionSubTitle}>로그</h4>
          <div className={st.log}>
            {vendingMachine.context.activityLog.length === 0
              ? <div className={st.muted}>로그가 여기에 표시됩니다.</div>
              : vendingMachine.context.activityLog.map((line, index) => <div key={index}>{line}</div>)
            }
          </div>

          <h4 className={st.sectionSubTitle}>현금 재고</h4>
          <div className={st.bankLine}>
            {AVAILABLE_CASH.map((cash) => (
              <span key={cash} className={st.muted}>
                {cash.toLocaleString()}원 x {vendingMachine.context.cashInventory[cash]}
              </span>
            ))}
          </div>

          <h4 className={st.sectionSubTitle}>보충</h4>
          <div className={st.row}>
            <button className={st.btn} onClick={() => vendingMachine.addDrinkStockByAdmin('cola', 1)}>cola +1</button>
            <button className={st.btn} onClick={() => vendingMachine.addDrinkStockByAdmin('water', 1)}>water +1</button>
            <button className={st.btn} onClick={() => vendingMachine.addDrinkStockByAdmin('coffee', 1)}>coffee +1</button>
          </div>

          <div className={st.row}>
            {AVAILABLE_CASH.map((cash) => (
              <button
                key={cash}
                className={st.btn}
                onClick={() => vendingMachine.addCashToInventoryByAdmin(cash, 1)}
              >
                {cash.toLocaleString()}원 +1
              </button>
            ))}
          </div>
        </li>
      </ul>
    </div>
  );
});

export default VendingMachine;
