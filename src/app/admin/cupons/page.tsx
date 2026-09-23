import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CouponManagerPage } from "@/modules/coupon-manager";
export const metadata:Metadata={title:"Coupon Manager | CRAZZY PROJECT"};
export default function AdminCoupons(){return <AppShell mode="admin" activeNav="coupon-manager" showFooter={false}><CouponManagerPage/></AppShell>}
