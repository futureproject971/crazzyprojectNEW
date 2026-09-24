import type {Metadata} from "next";
import {AuthPage} from "@/modules/auth/AuthPage";
export const metadata:Metadata={title:"Login com Discord | CRAZZY PROJECT",description:"Entre na CRAZZY PROJECT usando sua conta Discord."};
export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string;error?:string}>}){
  const query=await searchParams;
  const nextPath=query.next&&query.next.startsWith("/")&&!query.next.startsWith("//")?query.next:"/";
  return <AuthPage nextPath={nextPath} initialError={query.error||""}/>;
}
