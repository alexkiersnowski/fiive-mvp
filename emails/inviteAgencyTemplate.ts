/**
 * Email template for agency invitation to claim organization
 * 
 * @param clientName - Name of the client inviting the agency
 * @param inviteUrl - Full URL for the agency to claim their organization
 * @returns HTML string for the email
 */
export function inviteAgencyTemplate({
  clientName,
  inviteUrl,
}: {
  clientName: string;
  inviteUrl: string;
}): string {
  const assetBaseUrl =
    (process.env.EMAIL_ASSET_BASE_URL ||
      'https://xcaugnepttfnarkfulhf.supabase.co/storage/v1/object/public/public-assets').replace(/\/$/, '');
  const logoUrl = `${assetBaseUrl}/fiive-logo.png`;

  // Preserve exact structure, only inject clientName and inviteUrl variables
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accept Invitation - Fiive</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff;">
    <img src="${logoUrl}" alt="Fiive Logo" style="display: block; margin: 0 0 30px 0; max-height: 24px; -webkit-user-drag: none; -khtml-user-drag: none; -moz-user-drag: none; -o-user-drag: none; user-drag: none;">
    <h2 style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 35px; font-weight: 600; line-height: 40px; margin: 0;">${clientName} invited you to collaborate</h2>
    <p style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 24px 0 0 0;">Accept the invitation below to get started</p>
    <a href="${inviteUrl}" target="_blank" style="display: block; width: calc(100% - 0px); box-sizing: border-box; background-color: #1C2024; color: #FCFCFD; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 24px; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 32px 0 0 0; text-align: center;">Accept invitation</a>
    <a href="${inviteUrl}" target="_blank" style="display: block; width: calc(100% - 0px); box-sizing: border-box; color: rgba(3, 9, 26, 0.56); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; text-decoration: none; margin: 32px 0 0 0; word-wrap: break-word; overflow-wrap: break-word;">${inviteUrl}</a>
    <p style="display: block; width: calc(100% - 0px); box-sizing: border-box; color: rgba(3, 9, 26, 0.56); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; margin: 24px 0 0 0;">© 2025 Fiive Ltd. All rights reserved.</p>
    <a href="https://fiive.co" target="_blank" style="display: block; width: calc(100% - 0px); box-sizing: border-box; color: rgba(3, 9, 26, 0.56); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; text-decoration: none; margin: 4px 0 0 0;">fiive.co</a>
  </div>
</body>
</html>
  `.trim();
}

