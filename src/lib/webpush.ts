import webpush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

// Push is only active when both VAPID keys are present in the environment.
export const isPushConfigured = Boolean(publicKey && privateKey);

if (isPushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:reminders@fintrack.app',
    publicKey!,
    privateKey!,
  );
}

export default webpush;
