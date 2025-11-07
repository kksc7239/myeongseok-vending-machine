/**
 * 현금/거스름 관련 순수 유틸리티
 */

import type { CashInventory, CashType } from '../types';
import cloneDeep from 'lodash-es/cloneDeep';

/** 거스름 계산 시 사용할 액면가 순서 */
export const CASH_TYPE_ORDER: CashType[] = [10000, 5000, 1000, 500, 100];


/** CashInventory 합계 계산 */
export const sumCash = (inventory: CashInventory): number =>
  CASH_TYPE_ORDER.reduce((total, cash) => total + cash * inventory[cash], 0);

/** CashInventory에서 minusCashInventory를 차감한 새 CashInventory 반환 */
export function subtractCashFromInventory(
  cashInventory: CashInventory,
  minusCashInventory: CashInventory,
): CashInventory {
  const next = cloneDeep(cashInventory);
  for (const cash of CASH_TYPE_ORDER) {
    next[cash] -= minusCashInventory[cash];
  }
  return next;
}

/**
 * 거스름 지급 계획 계산
 * @param amount        거슬러 줄 총액
 * @param cashInventory 현재 보유 현금 재고
 * @returns             성공 시 { ok:true, refundCashInventory }, 실패 시 { ok:false }
 */
export function makeChangePlan(
  amount: number,
  cashInventory: CashInventory,
): { ok: true; refundCashInventory: CashInventory } | { ok: false } {
  const refundCashInventory: CashInventory = { 100: 0, 500: 0, 1000: 0, 5000: 0, 10000: 0 };
  let remaining = amount;

  for (const cash of CASH_TYPE_ORDER) {
    const requiredCount = Math.floor(remaining / cash);
    const usableCount = Math.min(requiredCount, cashInventory[cash]);
    if (usableCount > 0) {
      refundCashInventory[cash] += usableCount;
      remaining -= cash * usableCount;
    }
  }
  return remaining === 0 ? { ok: true, refundCashInventory } : { ok: false };
}
