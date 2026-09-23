export type ResellerAdminRow={
  id:string;user_id:string;discount_percent:number;active:boolean;expires_at:string|null;
  total_purchases:number;notes:string|null;created_at:string;updated_at:string;
  customer:{username:string|null;avatar_url:string|null;banned:boolean;discord_user_id:string|null;discord_username:string|null;guild_member:boolean};
  product_ids:string[];purchase_count:number;purchase_total:number;
};
export type ResellerProductOption={id:string;name:string;slug:string;image_url:string|null};
export type ResellerAdminPayload={resellers:ResellerAdminRow[];products:ResellerProductOption[]};
export type MyResellerSnapshot={
  reseller:null|{id:string;discount_percent:number;active:boolean;expires_at:string|null;total_purchases:number;created_at:string;updated_at:string;eligible:boolean};
  products:Array<{product_id:string;slug:string;product_name:string;image_url:string|null;status:string;status_label:string;plan_id:string;plan_name:string;plan_code:string|null;public_price:number;reseller_price:number;plan_sort:number}>;
  purchases:Array<{id:string;original_price:number;paid_price:number;created_at:string;product_name:string;plan_name:string;plan_code:string|null}>;
};
