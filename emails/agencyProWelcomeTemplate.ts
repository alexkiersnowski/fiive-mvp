/**
 * Email template for Agency Pro welcome email
 * 
 * @param firstName - First name of the organization owner
 * @returns HTML string for the email
 */
export function agencyProWelcomeTemplate({
  firstName,
}: {
  firstName: string;
}): string {
  const assetBaseUrl =
    (process.env.EMAIL_ASSET_BASE_URL ||
      'https://xcaugnepttfnarkfulhf.supabase.co/storage/v1/object/public/public-assets').replace(/\/$/, '');
  const logoUrl = `${assetBaseUrl}/fiive-logo.png`;
  const logoWhiteUrl = `${assetBaseUrl}/fiive-logo-white.png`;

  // Brand gradient colors
  const gradientColor1 = '#ED700A';
  const gradientColor2 = '#D45959';
  const gradientColor3 = '#2E9D95';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Agency Pro - Fiive</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff;">
    <!-- Top section with gradient background - using table for email compatibility -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(187deg, ${gradientColor1} 3.71%, ${gradientColor2} 51.17%, ${gradientColor3} 122.36%); border-radius: 8px; margin: 0;">
      <tr>
        <td style="padding: 24px;">
          <!-- Logo row -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 0;">
                <img src="${logoWhiteUrl}" alt="Fiive Logo" height="20" style="display: block; height: 20px; -webkit-user-drag: none; -khtml-user-drag: none; -moz-user-drag: none; -o-user-drag: none; user-drag: none; border: 0;">
              </td>
            </tr>
          </table>
          <!-- Spacer row to push bottom content down -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="height: 112px; line-height: 112px; font-size: 1px;">&nbsp;</td>
            </tr>
          </table>
          <!-- Bottom row with Agency Pro and Founding Member -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" valign="bottom" style="padding: 0;">
                <h2 style="color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 35px; font-weight: 600; line-height: 40px; margin: 0;">Agency Pro</h2>
              </td>
              <td align="right" valign="bottom" style="padding: 0;">
                <p style="color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 24px; margin: 0;">Founding Member</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Welcome heading -->
    <h1 style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 35px; font-weight: 600; line-height: 40px; margin: 40px 0 0 0;">Welcome to Fiive</h1>

    <!-- Welcome message -->
    <p style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 24px 0 0 0;">Hi ${firstName},</p>
    <p style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 16px 0 0 0;">Your Agency Pro subscription is active. You're one of the first 100 with full access to Fiive, and your founding-member rate is locked in for life.</p>

    <!-- Divider -->
    <div style="width: 100%; height: 1px; background-color: rgba(0, 0, 45, 0.09); margin: 40px 0;"></div>

    <!-- Next steps section -->
    <h2 style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 28px; margin: 0 0 16px 0;">Next steps</h2>
    <p style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 0 0 24px 0;">Over the next few days, we're here to help you get set up. If you need anything, email <a href="mailto:support@fiive.co" style="color: #1C2024; text-decoration: underline;">support@fiive.co</a> for priority support.</p>
    
    <ol style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 0 0 40px 0; padding-left: 24px; list-style-type: decimal;">
      <li style="margin-bottom: 8px; padding-left: 4px;">Finish setting up your agency profile</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Add your first clients</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Invite your team</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Start managing requests, tasks, and projects</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Invite or connect with your first clients</li>
    </ol>

    <!-- Divider -->
    <div style="width: 100%; height: 1px; background-color: rgba(0, 0, 45, 0.09); margin: 0 0 40px 0;"></div>

    <!-- Your Agency Pro access section -->
    <h2 style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 28px; margin: 0 0 16px 0;">Your Agency Pro access</h2>
    
    <ul style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 0 0 40px 0; padding-left: 24px; list-style-type: disc;">
      <li style="margin-bottom: 8px; padding-left: 4px;">Unlimited clients</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Unlimited team members</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Unlimited live connections</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Full client & relationship visibility</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Requests, projects & task management</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Shared links & resources</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">All current & future features</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Priority onboarding & support</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Influence the future of Fiive</li>
      <li style="margin-bottom: 8px; padding-left: 4px;">Founding member rate locked for life</li>
    </ul>

    <!-- Divider -->
    <div style="width: 100%; height: 1px; background-color: rgba(0, 0, 45, 0.09); margin: 0 0 40px 0;"></div>

    <!-- Closing message -->
    <p style="color: #1C2024; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; margin: 0 0 40px 0;">Welcome to the new way of running your agency.</p>

    <!-- Footer -->
    <img src="${logoUrl}" alt="Fiive Logo" style="display: block; margin: 0 0 16px 0; max-height: 24px; -webkit-user-drag: none; -khtml-user-drag: none; -moz-user-drag: none; -o-user-drag: none; user-drag: none;">
    <p style="display: block; width: calc(100% - 0px); box-sizing: border-box; color: rgba(3, 9, 26, 0.56); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; margin: 0 0 4px 0;">© 2025 Fiive Ltd. All rights reserved.</p>
    <a href="https://fiive.co" target="_blank" style="display: block; width: calc(100% - 0px); box-sizing: border-box; color: rgba(3, 9, 26, 0.56); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; text-decoration: none; margin: 0;">fiive.co</a>
  </div>
</body>
</html>
  `.trim();
}

