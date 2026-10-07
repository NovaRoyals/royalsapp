/** What a parent reads when starting a payment does not go through. Plain, and never a raw error. */
const BY_CODE: Record<string, string> = {
  sign_in: 'Sign in again to pay.',
  not_found: 'We couldn’t find that registration on your account.',
  not_approved: 'The club hasn’t approved this registration yet. You’ll be able to pay as soon as they do.',
  nothing_to_pay: 'There’s nothing to pay on this registration.',
  not_configured: 'Online payment isn’t switched on yet. The club will message you as soon as it is.',
  stripe_unavailable: 'The payment page isn’t available right now. Nothing was charged. Please try again in a few minutes.',
  bad_return: 'This version of the app can’t take payments from here. Please use the club’s web app.',
};

const GENERIC = 'Couldn’t start the payment. Nothing was charged. Please try again.';

export function checkoutMessage(code: string | undefined) {
  return code && Object.prototype.hasOwnProperty.call(BY_CODE, code) ? BY_CODE[code] : GENERIC;
}

/** What the page a family returns to from Stripe may say. It never says "paid": only the club's records do that. */
export function returnWording(payment: string | undefined) {
  if (payment === 'success') {
    return {
      title: 'Thank you. We’re confirming your payment.',
      body: 'Stripe has told us you completed payment. The club’s records update within a minute, and your registration will then show as paid. If it doesn’t, message the club and keep your email receipt.',
    };
  }
  if (payment === 'canceled') {
    return { title: 'No payment was taken.', body: 'You left the payment page before paying. You can come back and pay whenever you’re ready.' };
  }
  return { title: 'Nothing to show here.', body: 'Open your registration from Home to see where it stands.' };
}
