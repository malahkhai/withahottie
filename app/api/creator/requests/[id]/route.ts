import { getViewer } from '@/lib/auth/session';
import { readJson,fail } from '@/lib/http';
import { replyService,ownedPayment } from '@/lib/stripe/service';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const viewer=await getViewer();if(!viewer||viewer.demo||!['creator','admin'].includes(viewer.role))return fail('Creator sign-in required.',401);
 try {const {action}=await readJson(request);if(!['accept','decline'].includes(action))return fail('Reply in the conversation to fulfill this request.');
 const {db,engine}=replyService();const {data}=await db.from('reply_payments').select('id').eq('request_id',(await params).id).single();if(!data)return fail('Request unavailable.',404);
 await ownedPayment(data.id,viewer.id,'creator');const p=action==='accept'?await engine.accept(data.id,viewer.id):await engine.decline(data.id,viewer.id);
 return Response.json({ok:true,conversationId:p.conversation_id});
 }catch{return fail('Request unavailable, expired or awaiting payment reconciliation.',409);}
}
