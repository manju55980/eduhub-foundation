-- Rewrites delivery rows to provider-neutral statuses and prefixes existing
-- Resend delivery keys. Does not send mail.

update public.email_events
set status = case status
  when 'email.sent' then 'sent'
  when 'email.delivered' then 'delivered'
  when 'email.bounced' then 'bounced'
  when 'email.complained' then 'failed'
  else status
end
where kind = 'delivery'
  and status in ('email.sent', 'email.delivered', 'email.bounced', 'email.complained');

update public.email_events
set event_key = 'delivery:resend:' || substr(event_key, length('delivery:') + 1)
where kind = 'delivery'
  and event_key like 'delivery:%'
  and event_key not like 'delivery:resend:%'
  and event_key not like 'delivery:smtp2go:%'
  and length(event_key) > length('delivery:');

alter table public.email_events
  drop constraint email_events_kind_status_check;

alter table public.email_events
  add constraint email_events_kind_status_check check (
    (
      kind = 'outbound'
      and student_id is not null
      and status in ('pending', 'sent')
    )
    or (
      kind = 'delivery'
      and student_id is null
      and status in ('sent', 'delivered', 'opened', 'bounced', 'failed')
    )
  );
