-- Private conversation attachments, separate from public profile images.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-attachments','chat-attachments',false,1048576,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy chat_attachment_upload on storage.objects for insert to authenticated with check(bucket_id='chat-attachments' and (storage.foldername(name))[2]=auth.uid()::text and private.is_member(((storage.foldername(name))[1])::uuid));
create policy chat_attachment_read on storage.objects for select to authenticated using(bucket_id='chat-attachments' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy chat_attachment_delete on storage.objects for delete to authenticated using(bucket_id='chat-attachments' and (storage.foldername(name))[2]=auth.uid()::text);
create function public.send_chat_attachment(conversation uuid,content text,object_path text,mime text,bytes bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare new_message uuid;
begin
 if auth.uid() is null or not private.is_member(conversation) then raise exception 'Not authorized'; end if;
 if object_path not like (conversation::text||'/'||auth.uid()::text||'/%') or mime not in ('image/jpeg','image/png','image/webp') or bytes not between 1 and 1048576 then raise exception 'Invalid attachment'; end if;
 if not exists(select 1 from storage.objects where bucket_id='chat-attachments' and name=object_path) then raise exception 'Attachment not found'; end if;
 new_message:=public.send_chat_message(conversation,content);
 insert into public.media(owner_id,message_id,kind,visibility,storage_path,mime_type,size_bytes) values(auth.uid(),new_message,'image','private',object_path,mime,bytes);
 return new_message;
end; $$;
revoke all on function public.send_chat_attachment(uuid,text,text,text,bigint) from public;
grant execute on function public.send_chat_attachment(uuid,text,text,text,bigint) to authenticated;
commit;
