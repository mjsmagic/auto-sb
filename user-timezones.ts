import { WebClient, ErrorCode } from '@slack/web-api';

// Create a WebClient instance with the Slack API token
const client = new WebClient(process.env.SLACK_API_TOKEN);

// User ID for the user you want to get the timezone for
const userId = 'U12345678';

try {
  // Call the users.info API method with the user ID
  const response = await client.users.info({ user: userId });

  // Extract the timezone offset from the response
  const tzOffset = response.user.tz_offset;

  // Convert the timezone offset to hours
  const tzHours = tzOffset / 3600;

  // Print the timezone offset in hours
  console.log(`The user's timezone offset is ${tzHours} hours.`);

} catch (error) {
  // Check if the error is due to invalid credentials or user not found
  if (error.code === ErrorCode.PlatformError && error.data.error === 'user_not_found') {
    console.log('Error: User not found.');
  } else if (error.code === ErrorCode.WebAPIError && error.data.error === 'invalid_auth') {
    console.log('Error: Invalid credentials.');
  } else {
    console.log(`Error: ${error.message}`);
  }
}
