import assert from 'node:assert/strict';
import { calculateServerTotal } from '../supabase/functions/_shared/checkout.ts';

function db({mode='all',products=['p1'],categories=['g1'],excluded=['p1'],plan,fail,users=[],type='percentage',value=10}={}) {
 const tables={resellers:[],products:[{id:'p1',name:'First',active:true,game_id:'g1'},{id:'p2',name:'Second',active:true,game_id:'g2'}],product_plans:[{id:'a',product_id:'p1',name:'Day',price:100,active:true,plan_code:'1d'},{id:'b',product_id:'p2',name:'Day',price:200,active:true,plan_code:'1d'}],coupons:[{id:'c',active:true,max_uses:null,discount_type:type,discount_value:value,min_order_value:0,metadata:{scope_mode:mode,category_ids:categories,excluded_product_ids:excluded,allowed_plan_id:plan}}],coupon_products:products.map(product_id=>({coupon_id:'c',product_id})),coupon_users:users.map(user_id=>({coupon_id:'c',user_id})),coupon_usage:[]};
 return {from(table){let rows=tables[table]||[],single=false;const q={select(){return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return q},limit(n){rows=rows.slice(0,n);return q},maybeSingle(){single=true;return q},then(resolve,reject){return Promise.resolve({data:fail===table?null:single?rows[0]||null:rows,error:fail===table?{message:'offline'}:null,count:rows.length}).then(resolve,reject)}};return q}};
}
const cart=[{productId:'p1',planId:'a',quantity:1},{productId:'p2',planId:'b',quantity:1}];
for(const [mode,discount] of [['all',3000],['selected',1000],['categories',1000],['exclude',2000]]){
 const r=await calculateServerTotal(db({mode}),cart,'c','customer');assert.equal(r.error,undefined,mode);assert.equal(r.discountAmount,discount,mode);assert.equal(r.total,30000-discount,mode);
}
assert.ok((await calculateServerTotal(db({mode:'selected',products:[]}),cart,'c','customer')).error);
assert.ok((await calculateServerTotal(db({mode:'categories',categories:[]}),cart,'c','customer')).error);
assert.ok((await calculateServerTotal(db({mode:'selected',plan:'b'}),cart,'c','customer')).error,'plan and product restrictions intersect');
assert.equal((await calculateServerTotal(db({mode:'selected',type:'fixed',value:500}),cart,'c','customer')).discountAmount,10000,'fixed discount cannot spill to other products');
assert.ok((await calculateServerTotal(db({users:['other']}),cart,'c','customer')).error);
for(const table of ['coupon_users','coupon_products','coupon_usage'])assert.ok((await calculateServerTotal(db({fail:table}),cart,'c','customer')).error,'fail closed '+table);
assert.equal((await calculateServerTotal(db({mode:'categories',categories:['g2']}),cart,'c','customer')).discountAmount,2000);
console.log('[PASS] M48 authoritative checkout: scopes, mixed cart, fixed cap, plan intersection, customer restrictions and read failures');
