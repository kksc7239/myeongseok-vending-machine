/**
 * - 자판기 전체 상태(state)와 데이터(context)를 관리
 */

import { runInAction } from 'mobx';
import { useLocalObservable } from 'mobx-react';
import {
  makeChangePlan,
  subtractCashFromInventory,
  CASH_TYPE_ORDER,
  sumCash,
} from '../utils/cashChange';
import type {
  CashInventory,
  CashType,
  Drink,
  DrinkId,
  MachineState,
  VendingMachineContext,
} from '../types';

/** 현재 시간 */
const formatNow = () => new Date().toLocaleTimeString();

/** CashInventory를 뷰를 위한 문자열로 반환 */
const formatCashComposition = (plan: CashInventory): string => {
  const parts: string[] = [];
  for (const cash of CASH_TYPE_ORDER) {
    const quantity = plan[cash];
    if (quantity > 0) parts.push(`${cash.toLocaleString()}원 x${quantity}`);
  }
  return parts.length ? parts.join(', ') : '0원';
};

/** 초기 컨텍스트 */
const createInitialContext = (): VendingMachineContext => ({
  drinks: {
    cola:   { id: 'cola',   name: '콜라',  price: 1100,   stock: 5 },
    water:  { id: 'water',  name: '물',    price: 600,  stock: 1 },
    coffee: { id: 'coffee', name: '커피',  price: 700, stock: 6 },
  },
  paymentMethod: undefined,
  insertedCash: {
    100: 0,
    500: 0,
    1000: 0,
    5000: 0,
    10000: 0,
  },
  cashInventory: { 100: 10, 500: 0, 1000: 6, 5000: 2, 10000: 1 },
  activityLog: [],
});

/** 스토어 타입 정의 */
export type VendingMachineStore = {
  state: MachineState;
  context: VendingMachineContext;

  readonly insertedTotal: number;
  canAfford(drink: Drink): boolean;
  isPaymentReady: boolean;

  startCashFlow(): void;
  startCardFlow(): void;
  insertCash(cash: CashType): void;
  purchaseDrinkNow(drinkId: DrinkId): void;
  cancelFlow(): void;

  addDrinkStockByAdmin(drinkId: DrinkId, qty: number): void;
  addCashToInventoryByAdmin(cash: CashType, qty: number): void;

  pushLog(msg: string): void;
  finalizeToIdle(): void;
};

export default function useVendingMachine() {
  const store = useLocalObservable<VendingMachineStore>(() => ({
    // --- 초기 상태 ---
    state: 'Idle',
    context: createInitialContext(),

    /** 현금 투입 합계 */
    get insertedTotal() {
      return sumCash(this.context.insertedCash);
    },

    /** 투입한 금액으로 음료 구매 가능 여부 */
    canAfford(drink) {
      if (this.context.paymentMethod === 'card') return true;
      if (this.context.paymentMethod === 'cash') return this.insertedTotal >= drink.price;
      return false;
    },

    /** 결제 준비 여부 */
    get isPaymentReady() {
      return this.state === 'AwaitingCash' || this.state === 'CardReady';
    },

    /** 현금 결제 시작 */
    startCashFlow() {
      runInAction(() => {
        this.state = 'AwaitingCash';
        this.context.paymentMethod = 'cash';
        this.pushLog('결제수단: 현금 선택');
      });
    },

    /** 카드 결제 시작 (승인 완료 가정) */
    startCardFlow() {
      runInAction(() => {
        this.state = 'CardReady';
        this.context.paymentMethod = 'card';
        this.pushLog('결제수단: 카드 선택');
      });
    },

    /** 현금 투입 */
    insertCash(cash) {
      const nextTotal = this.insertedTotal + cash;
      runInAction(() => {
        this.context.cashInventory[cash] += 1;
        this.context.insertedCash[cash] += 1;
        this.pushLog(`${cash.toLocaleString()}원 투입 (누적 ${nextTotal.toLocaleString()}원)`);
      });
    },

    /** 구매 */
    purchaseDrinkNow(drinkId) {
      const drink = this.context.drinks[drinkId];
      if (!drink) return;

      // 품절 처리 : ui에서 품절상태일때 disabled이기 때문에 해당케이스는 발생하지 않지만 에러처리를 위해 추가.
      if (drink.stock <= 0) {
        window.alert('품절된 상품입니다.');
        return;
      }

      // 카드 결제 - 잔돈 상관없이 결제 완료.
      if (this.context.paymentMethod === 'card') {
        runInAction(() => {
          this.context.drinks[drink.id] = { ...drink, stock: drink.stock - 1 };
          this.pushLog(`출고(카드): ${drink.name}`);
        });
        window.alert('상품구매가 완료되었습니다.');
        this.finalizeToIdle();
        return;
      }

      // 현금 결제
      const changeAmount = this.insertedTotal - drink.price;

      //잔돈 없이 결제
      if (changeAmount === 0) {
        runInAction(() => {
          this.context.drinks[drink.id] = { ...drink, stock: drink.stock - 1 };
          this.pushLog(`출고(현금, 거스름 0): ${drink.name}`);
        });
        window.alert('상품구매가 완료되었습니다.');
        this.finalizeToIdle();
        return;
      }

      // 잔돈 필요 : 지급 가능 여부 계산
      const changePlanResult = makeChangePlan(changeAmount, this.context.cashInventory);
      // 잔돈 지급 불가
      if (!changePlanResult.ok) {
        //받은돈 그대로 돌려줌
        const refundGiven = this.context.insertedCash;
        const refundText = formatCashComposition(refundGiven);

        runInAction(() => {
          this.context.cashInventory = subtractCashFromInventory(this.context.cashInventory, refundGiven);
          this.pushLog(`거스름 불가: 환불 지급(그대로) → ${refundText}`);
        });

        window.alert(`잔돈이 부족합니다. ${refundText}를 반환합니다.`);
        this.finalizeToIdle();
        return;
      }

      // 잔돈 지급 가능 : 재고 차감 + 잔돈 지급
      runInAction(() => {
        //음료 출고 
        this.context.drinks[drink.id] = { ...drink, stock: drink.stock - 1 };
        //잔돈 지급
        this.context.cashInventory = subtractCashFromInventory(
          this.context.cashInventory,
          changePlanResult.refundCashInventory,
        );
        const changeText = formatCashComposition(changePlanResult.refundCashInventory);
        this.pushLog(`거스름 지급: ${changeText}`);
        window.alert(`상품구매가 완료되었습니다. 잔돈은 ${changeText} 입니다.`);
      });

      this.finalizeToIdle();
    },

    /** 결제 취소 */
    cancelFlow() {
      // 현금: 넣은게 있을경우
      if (this.state === 'AwaitingCash' && this.insertedTotal > 0) {
        const refundGiven = this.context.insertedCash;
        const refundText = formatCashComposition(refundGiven);

        runInAction(() => {
          this.context.cashInventory = subtractCashFromInventory(this.context.cashInventory, refundGiven);
          this.pushLog(`취소: 환불 지급 → ${refundText}`);
        });

        window.alert(`취소 환불: ${refundText}를 반환합니다.`);
      }

      this.finalizeToIdle();
    },

    /** 관리자: 음료 재고 보충 */
    addDrinkStockByAdmin(drinkId, quantity) {
      const drink = this.context.drinks[drinkId];
      runInAction(() => {
        this.context.drinks[drinkId].stock = Math.max(0, drink.stock + quantity);
        this.pushLog(`관지라: ${drink.name} 재고 ${quantity > 0 ? '+' : ''}${quantity}`);
      });
    },

    /** 관리자: 현금 재고 보충 */
    addCashToInventoryByAdmin(cash, quantity) {
      runInAction(() => {
        this.context.cashInventory[cash] += quantity;
        this.pushLog(`관리자: ${cash.toLocaleString()}원 x${quantity} 추가`);
      });
    },

    /** 로그 기록 */
    pushLog(message: string) {
      this.context.activityLog.unshift(`[${formatNow()}] ${message}`);
    },

    /** 거래 종료 후 Idle 복귀 : 초기화 */
    finalizeToIdle() {
      runInAction(() => {
        this.state = 'Idle';
        this.context.paymentMethod = undefined;
        this.context.insertedCash = { 100: 0, 500: 0, 1000: 0, 5000: 0, 10000: 0 };
        this.pushLog('대기 상태로 전환');
      });
    },
  }));

  return { vendingMachine: store };
}
