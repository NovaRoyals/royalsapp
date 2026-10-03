-- Payment status gets a vocabulary that matches how money actually moves.
--
-- `registration_status` already separates "the club said yes" from "the family paid".
-- `payment_status` only knew unpaid / pending / paid / refunded, which cannot say that a
-- payment was never requested, is awaiting the family, failed, or was waived.
--
-- Postgres cannot use a new enum value in the transaction that adds it, so the values live
-- alone in this file and the next migration uses them. `unpaid` and `pending` stay in the
-- type (a value cannot be dropped) but nothing writes them any more.

alter type public.payment_status add value if not exists 'not_requested';
alter type public.payment_status add value if not exists 'awaiting_payment';
alter type public.payment_status add value if not exists 'processing';
alter type public.payment_status add value if not exists 'failed';
alter type public.payment_status add value if not exists 'canceled';
alter type public.payment_status add value if not exists 'waived';
alter type public.payment_status add value if not exists 'partially_refunded';
