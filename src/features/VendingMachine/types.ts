/**
 * 타입 정의
 */

export type DrinkId = 'cola' | 'water' | 'coffee';               // 음료 식별자
export type PaymentMethod = 'cash' | 'card';                      // 결제 수단
export type CashType = 100 | 500 | 1000 | 5000 | 10000;       // 지원 화폐 단위

/**
 * 자판기의 단계별 상태 정의
 */
export type MachineState =
  | 'Idle'           // 초기/대기: 결제 수단 선택 전
  | 'AwaitingCash'   // 현금 투입 단계
  | 'CardReady';     // 카드 사용 준비 완료(승인 완료 가정)

/** 음료 엔티티 */
export interface Drink {
  id: DrinkId;
  name: string;     // 화면 표시용 이름
  price: number;    // 가격(원)
  stock: number;    // 재고 수량
}

/**
 * 현금 구조
 */
export type CashInventory = Record<CashType, number>;

/**
 * 자판기 컨텍스트
 */
export interface VendingMachineContext {
  drinks: Record<DrinkId, Drink>;
  paymentMethod?: PaymentMethod;        // 선택된 결제 수단
  insertedCash: CashInventory;          // 사용자가 투입한 화폐 조합
  cashInventory: CashInventory;         // 자판기가 보유한 현금
  activityLog: string[];                // 자판기 로그 (관리자 확인용)
}
