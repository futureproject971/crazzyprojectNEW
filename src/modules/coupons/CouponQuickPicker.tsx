"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomerCoupon } from "./types";

export function CouponQuickPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (code: string) => void;
}) {
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/coupons", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setCoupons((payload.coupons || []).filter((coupon: CustomerCoupon) => coupon.status === "available"));
      })
      .finally(() => setLoaded(true));
  }, []);

  const suggestions = useMemo(() => coupons.slice(0, 6), [coupons]);

  if (!loaded || !suggestions.length) {
    return (
      <a className="crz-coupon-picker__wallet-link" href="/painel/cupons">
        Meus cupons
      </a>
    );
  }

  return (
    <div className="crz-coupon-picker">
      <div className="crz-coupon-picker__head">
        <span>Seus cupons disponíveis</span>
        <a href="/painel/cupons">Ver todos</a>
      </div>
      <div>
        {suggestions.map((coupon) => (
          <button
            type="button"
            key={coupon.id}
            className={value === coupon.code ? "is-selected" : ""}
            onClick={() => onSelect(coupon.code)}
          >
            <strong>{coupon.code}</strong>
            <span>{coupon.discount_type === "percentage" ? coupon.discount_value + "%" : "R$ " + coupon.discount_value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
