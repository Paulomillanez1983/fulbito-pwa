alter table public.live_stream_permissions
  alter column allowed_stream_types set default array['match'::public.live_stream_type, 'final'::public.live_stream_type, 'draw'::public.live_stream_type];

update public.live_stream_permissions
set allowed_stream_types = array_append(allowed_stream_types, 'draw'::public.live_stream_type)
where not ('draw'::public.live_stream_type = any(allowed_stream_types));
