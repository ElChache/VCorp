# Product Clarifications

## Phase 1: Initial Requirements Gathering

<question id="1" status="answered">
  <from>PM</from>
  <text>For the email notification system, do you have a preference for which email service provider to use (SendGrid, AWS SES, Mailgun, etc.)? Or should we evaluate and recommend the most cost-effective solution for the beta launch?</text>
  <answer>
    <from>Human</from>
    <text>Generic email delivery is acceptable for Release 1.0. Use whatever email service is easiest to integrate (SendGrid, etc.) with a generic from address. We can enhance branding later.</text>
  </answer>
</question>

<question id="2" status="answered">
  <from>PM</from>
  <text>For monitor evaluation scheduling, should users be able to set custom check frequencies, or should the AI automatically determine optimal frequencies based on the monitor type? If custom, what should be the minimum and maximum check intervals?</text>
  <answer>
    <from>Human</from>
    <text>Yes, absolutely. Users should have both visibility and control. Show "Last checked: X minutes ago" and provide a manual refresh button. Users need transparency about when their monitors were last evaluated.</text>
  </answer>
</question>

<question id="3" status="answered">
  <from>PM</from>
  <text>What specific data sources should the AI be able to search for real-world information? Should we integrate specific APIs (stock market APIs, weather APIs, sports APIs) or rely solely on web scraping and search capabilities?</text>
  <answer>
    <from>Human</from>
    <text>For Release 1.0, rely primarily on web scraping and search capabilities. We can add specific APIs in future releases based on user demand and most common monitor types.</text>
  </answer>
</question>

<question id="4" status="answered">
  <from>PM</from>
  <text>For the beta user whitelist, how will these email addresses be provided to us? Should we build an admin interface for managing the whitelist, or will this be a hard-coded configuration file initially?</text>
  <answer>
    <from>Human</from>
    <text>I will provide complete list, but for now start with [dcerezoi@pm.me, davidcerezoinigo@gmail.com]. Implement system where I can add emails through admin interface.</text>
  </answer>
</question>

<question id="5" status="answered">
  <from>PM</from>
  <text>Regarding monitor limits and rate limiting: While you mentioned "no monitor limits per user," what reasonable rate limits should we implement to prevent abuse? For example, maximum monitors per user (100? 500?) and minimum check intervals?</text>
  <answer>
    <from>Human</from>
    <text>10 monitors per user for now, with rate limiting to prevent abuse. We can increase limits later based on system performance and user feedback.</text>
  </answer>
</question>

<question id="6" status="answered">
  <from>PM</from>
  <text>For the portal website and authentication flow, should the portal be a completely separate application or integrated into the main SvelteKit application? This affects our architecture and deployment strategy.</text>
  <answer>
    <from>Human</from>
    <text>This is an architectural decision for the team to make. Choose whatever approach provides the best user experience and simplest deployment for Release 1.0.</text>
  </answer>
</question>

<question id="7" status="answered">
  <from>PM</from>
  <text>What level of detail should be included in email notifications? Should they include: just the state change, the current value, historical chart/data, links back to the dashboard, or all of the above?</text>
  <answer>
    <from>Human</from>
    <text>All of the above, and professional looking. Include state change, current value, historical chart/data, and links back to dashboard. Make the emails comprehensive and visually appealing.</text>
  </answer>
</question>

<question id="8" status="answered">
  <from>PM</from>
  <text>For failed monitor evaluations (e.g., data source unavailable), how should the system behave? Should it retry automatically, notify the user, mark the monitor as "evaluation failed," or silently skip until next scheduled check?</text>
  <answer>
    <from>Human</from>
    <text>Users should see the errors for Release 1.0. However, this should be a switch we can turn on and off. Implement visible error states in the dashboard with detailed error information, but make this configurable for future releases.</text>
  </answer>
</question>

<question id="9" status="answered">
  <from>PM</from>
  <text>Should users be able to share or make their monitors public in Release 1.0? Or is this strictly a single-user, private monitoring system for the beta?</text>
  <answer>
    <from>Human</from>
    <text>Public monitors will be for next releases. Keep it strictly single-user/private for Release 1.0 beta.</text>
  </answer>
</question>

<question id="10" status="answered">
  <from>PM</from>
  <text>For the AI provider abstraction layer, what specific criteria should trigger an automatic provider switch? Response time thresholds, error rates, cost limits, or manual configuration only?</text>
  <answer>
    <from>Human</from>
    <text>Manual only, a feature flag. No automatic switching for Release 1.0 - keep it simple and controllable.</text>
  </answer>
</question>

<question id="11" status="answered">
  <from>PM</from>
  <text>What branding elements do you envision? Do you have a product name, color scheme preferences, or design style (modern/minimal, playful, professional) in mind for the UI?</text>
  <answer>
    <from>Human</from>
    <text>Proceed with "Monitors!" as the application name. This branding works well. Modern/minimal professional design style.</text>
  </answer>
</question>

<question id="12" status="answered">
  <from>PM</from>
  <text>For monitor history retention, how long should we store historical data points? 30 days, 90 days, 1 year, or indefinitely for beta users?</text>
  <answer>
    <from>Human</from>
    <text>1 year data retention policy. Keep all historical data for 1 year, then archive or delete older data to manage storage costs.</text>
  </answer>
</question>

<question id="13" status="answered">
  <from>PM</from>
  <text>Should the system support monitor templates or examples to help new users get started? For instance, pre-built monitors for common use cases like "Tesla stock drops 5%" or "Rain expected tomorrow"?</text>
  <answer>
    <from>Human</from>
    <text>Yes we can include templates, the UX needs to be flawless. Provide helpful examples and templates to get users started quickly.</text>
  </answer>
</question>

<question id="14" status="answered">
  <from>PM</from>
  <text>For the password reset flow, should we implement email-based reset immediately, or is a simpler admin-managed reset acceptable for the beta phase?</text>
  <answer>
    <from>Human</from>
    <text>Email-based reset immediately. Implement proper password reset flow from the start.</text>
  </answer>
</question>

<question id="15" status="answered">
  <from>PM</from>
  <text>Regarding monitor validation, should there be any restrictions on what users can monitor? For example, should we prevent monitoring of private/personal data, illegal content, or impose any ethical guidelines?</text>
  <answer>
    <from>Human</from>
    <text>Yes we shouldn't allow illegal content. Implement content validation to prevent monitoring of clearly illegal content, but don't be overly restrictive.</text>
  </answer>
</question>

## Phase 2: Deeper Product Understanding

<question id="16" status="answered">
  <from>PM</from>
  <text>For the admin interface to manage beta users, what specific capabilities should it have? Just add/remove emails, or also view user activity, monitor counts, disable accounts, etc.?</text>
  <answer>
    <from>Human</from>
    <text>Also view user activity, monitor counts, disable accounts. Full admin capabilities for managing beta users and their usage.</text>
  </answer>
</question>

<question id="17" status="answered">
  <from>PM</from>
  <text>Should the manual refresh button for monitors have any rate limiting? For example, maximum 1 refresh per minute to prevent API abuse?</text>
  <answer>
    <from>Human</from>
    <text>Yes it should, and there should be a total maximum of requests per user, configurable per account, and we will start with an initial value of 50 requests per user, to be safe. It should be easy to configure this value through feature flags (like split). It should be possible in the future to define different plans that set different limits. For now there will only be one plan with a very low limit of 50 requests per day - this includes manual and automated requests.</text>
  </answer>
</question>

<question id="18" status="answered">
  <from>PM</from>
  <text>For monitor templates, should these be static examples or dynamic templates that actually create a pre-configured monitor? Should users be able to save their own monitors as templates?</text>
  <answer>
    <from>Human</from>
    <text>No static examples is fine. We just need a very flawless NUX - new user experience tutorial.</text>
  </answer>
</question>

<question id="19" status="answered">
  <from>PM</from>
  <text>When a monitor evaluation fails, should we differentiate between types of failures (AI error, data source unavailable, rate limit hit) in the UI? This affects how users understand and respond to issues.</text>
  <answer>
    <from>Human</from>
    <text>Yes, differentiate. Users should understand what type of failure occurred so they can respond appropriately.</text>
  </answer>
</question>

<question id="20" status="answered">
  <from>PM</from>
  <text>For the "Monitors!" branding, do you have any logo concepts or should the design team create options? Any specific visual identity preferences beyond modern/minimal?</text>
  <answer>
    <from>Human</from>
    <text>Friendly, not corporate like. Like a user application for users. Design team should create options with this friendly, approachable aesthetic.</text>
  </answer>
</question>

<question id="21" status="answered">
  <from>PM</from>
  <text>Should monitors have a pause/disable feature separate from deletion? Users might want to temporarily stop monitoring without losing their configuration and history.</text>
  <answer>
    <from>Human</from>
    <text>Yes absolutely, monitors can be paused. Users should be able to temporarily disable monitoring without losing configuration and history.</text>
  </answer>
</question>

<question id="22" status="answered">
  <from>PM</from>
  <text>For email notifications, should users be able to set quiet hours (e.g., no emails between 10pm-7am) or should all triggers send immediately regardless of time?</text>
  <answer>
    <from>Human</from>
    <text>Email notifications are real time when the monitor triggers the action (when it changes the status). No quiet hours - immediate delivery.</text>
  </answer>
</question>

<question id="23" status="answered">
  <from>PM</from>
  <text>When displaying historical charts in emails, what time range should be shown by default? Last 24 hours, 7 days, 30 days, or dynamically based on the monitor type?</text>
  <answer>
    <from>Human</from>
    <text>To be determined by AI - that depends on the query "change" itself. Let the AI choose the most relevant time range for each specific monitor type and change event.</text>
  </answer>
</question>

<question id="24" status="answered">
  <from>PM</from>
  <text>Should the dashboard have a global overview showing aggregate statistics (total monitors, active alerts, check frequency) or focus purely on individual monitor cards?</text>
  <answer>
    <from>Human</from>
    <text>Yes it should. The main view should be the individual monitor cards, but it should be possible (and easy) for the user to access such dashboard. Probably from the account section, but we will leave this to the discretion of the UX expert.</text>
  </answer>
</question>

<question id="25" status="answered">
  <from>PM</from>
  <text>For illegal content detection, should we log attempted violations for review, or simply reject them silently? This affects our ability to improve the filter and understand user intent.</text>
  <answer>
    <from>Human</from>
    <text>Log them for review. We need visibility into attempted violations to improve the filter and understand patterns.</text>
  </answer>
</question>

<question id="26" status="answered">
  <from>PM</from>
  <text>Should monitors support tags or categories for organization? With a 10 monitor limit this might not be necessary initially, but it could improve UX as users approach the limit.</text>
  <answer>
    <from>Human</from>
    <text>Let's add that for the next release. Not needed for Release 1.0 with the 10 monitor limit.</text>
  </answer>
</question>

<question id="27" status="answered">
  <from>PM</from>
  <text>For the data source being primarily web scraping, should we show users which sources we're checking? This transparency might help them understand accuracy and limitations.</text>
  <answer>
    <from>Human</from>
    <text>Yes absolutely. Show users which data sources we're checking for transparency. This helps them understand accuracy and limitations.</text>
  </answer>
</question>

<question id="28" status="answered">
  <from>PM</from>
  <text>Should email notifications include an unsubscribe link for specific monitors, or only a global email preferences link? This affects how granularly users can control notifications.</text>
  <answer>
    <from>Human</from>
    <text>Yes users should be able to "unsubscribe" for specific monitors - I quote it because it would not actually unsubscribe but remove the trigger and action associated to the monitor.</text>
  </answer>
</question>

<question id="29" status="answered">
  <from>PM</from>
  <text>For monitors that track numerical values (stocks, weather), should we offer threshold alerts beyond just state changes? E.g., "Alert me every time Tesla moves ±5%" vs only on crossing $200?</text>
  <answer>
    <from>Human</from>
    <text>Yes we should offer threshold alerts. And also visual cues on the monitor card - red, yellow and so on.</text>
  </answer>
</question>

<question id="30" status="answered">
  <from>PM</from>
  <text>What should happen to a user's monitors and data if they're removed from the beta whitelist? Immediate deactivation, grace period, or data export option?</text>
  <answer>
    <from>Human</from>
    <text>Grace period of 1 week. Give users time to export their data or address any issues before full deactivation.</text>
  </answer>
</question>

## Phase 3: Implementation Details & Edge Cases

<question id="31" status="answered">
  <from>PM</from>
  <text>For the 50 requests/day limit, how should we handle the user experience when they hit the limit? Show remaining count proactively, warn at 80%, or only notify when limit is reached?</text>
  <answer>
    <from>Human</from>
    <text>Warn at 80%. Show a warning when users reach 40 requests to help them manage their usage proactively.</text>
  </answer>
</question>

<question id="32" status="answered">
  <from>PM</from>
  <text>Should the admin panel be a separate route (/admin) with its own authentication, or integrated into the main app for specific admin users? Security vs convenience trade-off.</text>
  <answer>
    <from>Human</from>
    <text>In general separate routes for separate views for optimal navigation, but let's follow best current UX standards.</text>
  </answer>
</question>

<question id="33" status="answered">
  <from>PM</from>
  <text>For the "friendly, not corporate" design - are there specific apps or services whose design aesthetic you admire that we could reference? (e.g., Notion, Linear, Discord)</text>
  <answer>
    <from>Human</from>
    <text>Discord is a good example. Friendly, approachable design that users love.</text>
  </answer>
</question>

<question id="34" status="answered">
  <from>PM</from>
  <text>When showing data sources to users, how detailed should this be? Just domain names (e.g., "yahoo.com"), or full URLs, or categorized sources like "Financial Data: Yahoo Finance"?</text>
  <answer>
    <from>Human</from>
    <text>Categorized, with option to navigate to origin URL. Show organized categories but let users drill down to actual sources.</text>
  </answer>
</question>

<question id="35" status="answered">
  <from>PM</from>
  <text>For threshold alerts on numerical values, should users be able to set multiple thresholds per monitor? E.g., "Warn at 5%, Alert at 10%, Critical at 15%"?</text>
  <answer>
    <from>Human</from>
    <text>Yes, but only in "advanced" view. It should be easy for user to set the minimal configuration. The UX needs to be flawless, very easy to set the minimum config.</text>
  </answer>
</question>

<question id="36" status="answered">
  <from>PM</from>
  <text>Should paused monitors count against the 10 monitor limit, or should users be able to have 10 active + additional paused monitors?</text>
  <answer>
    <from>Human</from>
    <text>The limit is in number of active monitors, so users can have 10 active + additional paused monitors.</text>
  </answer>
</question>

<question id="37" status="answered">
  <from>PM</from>
  <text>For the NUX tutorial, should it be an interactive walkthrough (tooltips/overlays), a video, a sample monitor creation, or documentation? What's the ideal onboarding experience?</text>
  <answer>
    <from>Human</from>
    <text>Optional interactive walkthrough. Users should be able to skip it but it should guide them through creating their first monitor.</text>
  </answer>
</question>

<question id="38" status="answered">
  <from>PM</from>
  <text>When AI determines the time range for email charts, should there be min/max bounds? E.g., minimum 1 hour, maximum 30 days, to ensure charts are meaningful?</text>
  <answer>
    <from>Human</from>
    <text>Yes, that sounds good. Minimum 1 hour, maximum 30 days to ensure charts are meaningful.</text>
  </answer>
</question>

<question id="39" status="answered">
  <from>PM</from>
  <text>For monitor evaluation errors, should failed attempts count against the 50/day limit? This affects how users can retry after failures.</text>
  <answer>
    <from>Human</from>
    <text>No, failed attempts shouldn't count against the limit. Users should be able to retry without penalty when things fail.</text>
  </answer>
</question>

<question id="40" status="answered">
  <from>PM</from>
  <text>Should the system auto-pause monitors that fail repeatedly (e.g., 5 consecutive failures), or keep trying indefinitely until user intervenes?</text>
  <answer>
    <from>Human</from>
    <text>Yes, after 5 consecutive failures, auto-pause the monitor to prevent resource waste and notify the user.</text>
  </answer>
</question>

<question id="41" status="answered">
  <from>PM</from>
  <text>For data export during grace period, what format is preferred? JSON for technical users, CSV for spreadsheets, or both options?</text>
  <answer>
    <from>Human</from>
    <text>Both, user can choose. Also, users should be able to export monitors at any time, not just during grace period.</text>
  </answer>
</question>

<question id="42" status="answered">
  <from>PM</from>
  <text>Should monitor history be exportable at any time (not just during removal), allowing users to backup their data regularly?</text>
  <answer>
    <from>Human</from>
    <text>Yes, should be exportable at any time. Users should be able to backup their data regularly.</text>
  </answer>
</question>

<question id="43" status="answered">
  <from>PM</from>
  <text>For the global statistics dashboard, should it show historical trends (requests over time, monitors created/deleted) or just current snapshot?</text>
  <answer>
    <from>Human</from>
    <text>Historical trends and current snapshot. Show both comprehensive analytics and current state.</text>
  </answer>
</question>

<question id="44" status="answered">
  <from>PM</from>
  <text>When monitors trigger while paused, should we track these "would-have-triggered" events to show users what they missed?</text>
  <answer>
    <from>Human</from>
    <text>No, no need. If it was paused, they miss the events. Keep it simple.</text>
  </answer>
</question>

<question id="45" status="answered">
  <from>PM</from>
  <text>For illegal content logging, who should have access to review these logs? Just you as the human owner, or should there be a moderation interface?</text>
  <answer>
    <from>Human</from>
    <text>Me as the human owner. For now we just show them somewhere in the admin tool application/interface.</text>
  </answer>
</question>

## Phase 4: Final Validation & Launch Readiness

<question id="46" status="answered">
  <from>PM</from>
  <text>For the initial launch, should we have a "beta" or "preview" label visible in the UI to set user expectations, or present it as a full product?</text>
  <answer>
    <from>Human</from>
    <text>Yes we should show beta label. Set appropriate expectations for beta users.</text>
  </answer>
</question>

<question id="47" status="answered">
  <from>PM</from>
  <text>Should we implement any kind of feedback mechanism (feedback button, survey, bug report) directly in the app for beta users?</text>
  <answer>
    <from>Human</from>
    <text>Feedback button and bug report for beta users. Essential for beta feedback collection.</text>
  </answer>
</question>

<question id="48" status="answered">
  <from>PM</from>
  <text>For monitors that check competitive or sensitive information (like competitor prices), should we have any special handling or disclaimers?</text>
  <answer>
    <from>Human</from>
    <text>No need for now. Keep it simple for Release 1.0.</text>
  </answer>
</question>

<question id="49" status="answered">
  <from>PM</from>
  <text>What should happen if a user tries to create duplicate monitors (exact same prompt)? Allow, warn, or prevent?</text>
  <answer>
    <from>Human</from>
    <text>Prevent for same user. Don't allow users to create exact duplicate monitors.</text>
  </answer>
</question>

<question id="50" status="answered">
  <from>PM</from>
  <text>For the admin panel's violation logs, should we categorize violations by type (violence, illegal activity, privacy violation) or just show a generic log?</text>
  <answer>
    <from>Human</from>
    <text>Generic log for now. Keep it simple for Release 1.0, can categorize later.</text>
  </answer>
</question>

<question id="51" status="answered">
  <from>PM</from>
  <text>Should monitor names be auto-generated from the prompt, user-defined, or both with auto-generation as default?</text>
  <answer>
    <from>Human</from>
    <text>Both with auto-generation as default. Users can edit the auto-generated names.</text>
  </answer>
</question>

<question id="52" status="answered">
  <from>PM</from>
  <text>For email notifications, should we include a preview/summary in the email subject line, or keep it generic like "Monitor Alert: [Monitor Name]"?</text>
  <answer>
    <from>Human</from>
    <text>Include preview/summary in the email subject line. Make emails immediately informative.</text>
  </answer>
</question>

<question id="53" status="answered">
  <from>PM</from>
  <text>When users hit their 10 active monitor limit, what CTA should we show? Upgrade teaser for future plans, or just "pause existing monitors"?</text>
  <answer>
    <from>Human</from>
    <text>Upgrade teaser for future plans. Plant seeds for monetization and growth.</text>
  </answer>
</question>

<question id="54" status="answered">
  <from>PM</from>
  <text>Should we track and display monitor accuracy/reliability metrics to users (e.g., "This monitor has been 95% accurate")?</text>
  <answer>
    <from>Human</from>
    <text>Only if it is possible to figure out the past accuracy properly. Don't show inaccurate accuracy metrics.</text>
  </answer>
</question>

<question id="55" status="answered">
  <from>PM</from>
  <text>For the categorized data sources display, should users be able to exclude certain sources they don't trust?</text>
  <answer>
    <from>Human</from>
    <text>That will be in the next release. Keep Release 1.0 focused on core functionality.</text>
  </answer>
</question>

<question id="56" status="answered">
  <from>PM</from>
  <text>Should there be a "test mode" where users can test their monitor prompts without using their daily request limit?</text>
  <answer>
    <from>Human</from>
    <text>Nope. Because we are using requests, and losing money. Every request has a cost.</text>
  </answer>
</question>

<question id="57" status="answered">
  <from>PM</from>
  <text>For monitors tracking time-sensitive events (like "meeting starts in 1 hour"), how should we handle timezone differences and daylight saving time?</text>
  <answer>
    <from>Human</from>
    <text>That is a poor example because I don't think the AI knows anything about this meeting, so this prompt should be rejected as not valid, and an explanation given to the user. But to your question, we should assume that the user is using his local time and use UTC internally for all operations.</text>
  </answer>
</question>

<question id="58" status="answered">
  <from>PM</from>
  <text>Should successful monitor evaluations show the raw data that was analyzed, or just the interpreted result?</text>
  <answer>
    <from>Human</from>
    <text>Optionally should also show raw data. Give users transparency into what was analyzed.</text>
  </answer>
</question>

<question id="59" status="answered">
  <from>PM</from>
  <text>What's the maximum historical data points we should display in the dashboard charts? 100, 500, 1000 points before requiring pagination?</text>
  <answer>
    <from>Human</from>
    <text>Something reasonable for performance, I guess 200-300, but the FE engineers should have a better idea.</text>
  </answer>
</question>

<question id="60" status="answered">
  <from>PM</from>
  <text>Finally, what's your vision for the first user's "aha moment" - what specific experience should make them think "this is amazing"?</text>
  <answer>
    <from>Human</from>
    <text>When they understand they can use this application to do amazing things like buy cheap things, find amazing deals, and even as an investment tool!</text>
  </answer>
</question>

## Phase 5: Launch & Operations Readiness

<question id="61" status="answered">
  <from>PM</from>
  <text>For the feedback/bug report feature, should reports go to a database, email you directly, or integrate with a tool like GitHub Issues?</text>
  <answer>
    <from>Human</from>
    <text>GitHub Issues integration. Keep feedback organized and trackable in the development workflow.</text>
  </answer>
</question>

<question id="62" status="answered">
  <from>PM</from>
  <text>Should we implement any monitoring for our own system health (uptime, API response times, error rates) visible to you in the admin panel?</text>
  <answer>
    <from>Human</from>
    <text>Yes all of that. Full system health monitoring in the admin panel - uptime, API response times, error rates.</text>
  </answer>
</question>

<question id="63" status="answered">
  <from>PM</from>
  <text>For beta users who create valuable monitor templates, should we have a way to promote these as examples for new users (with permission)?</text>
  <answer>
    <from>Human</from>
    <text>Yes great idea. Curate the best user-created monitors as examples for new users, with proper permission and attribution.</text>
  </answer>
</question>

<question id="64" status="answered">
  <from>PM</from>
  <text>When the AI can't interpret a monitor prompt, should we log these for improving our prompt processing, and if so, should users be notified their prompt is being reviewed?</text>
  <answer>
    <from>Human</from>
    <text>Yes exactly that. Log uninterpretable prompts for AI improvement and notify users that their prompt is being reviewed for better processing.</text>
  </answer>
</question>

<question id="65" status="answered">
  <from>PM</from>
  <text>For the "aha moment" around deals and investments - should we have pre-built monitor categories like "Deal Hunting", "Investment Tracking", "Price Drops"?</text>
  <answer>
    <from>Human</from>
    <text>Yes that's a very good idea! Let's include pre-built monitor categories with a good amount in the library. Connect the product directly to the user value proposition.</text>
  </answer>
</question>

<question id="66" status="answered">
  <from>PM</from>
  <text>Should email notifications have a "snooze" feature where users can temporarily disable emails for a specific monitor without pausing it?</text>
  <answer>
    <from>Human</from>
    <text>Yes absolutely</text>
  </answer>
</question>

<question id="67" status="answered">
  <from>PM</from>
  <text>For monitors that track prices, should we show percentage change in addition to absolute values on the monitor cards?</text>
  <answer>
    <from>Human</from>
    <text>Yes yes</text>
  </answer>
</question>

<question id="68" status="answered">
  <from>PM</from>
  <text>When displaying raw data optionally, should this be in a collapsible section, modal, or separate detail page?</text>
  <answer>
    <from>Human</from>
    <text>Separate detail page, but we should follow best UI/UX practices</text>
  </answer>
</question>

<question id="69" status="answered">
  <from>PM</from>
  <text>For the upgrade teaser when hitting limits, should we collect email addresses for a waitlist, or just show "Coming Soon"?</text>
  <answer>
    <from>Human</from>
    <text>Collect waitlist emails</text>
  </answer>
</question>

<question id="70" status="answered">
  <from>PM</from>
  <text>Should the admin panel show real-time active users, or just daily/weekly summaries?</text>
  <answer>
    <from>Human</from>
    <text>Realtime and daily/weekly summaries</text>
  </answer>
</question>

<question id="71" status="answered">
  <from>PM</from>
  <text>For beta user onboarding, should we require them to agree to specific beta terms (data may be deleted, features may change)?</text>
  <answer>
    <from>Human</from>
    <text>Yes, yes good idea</text>
  </answer>
</question>

<question id="72" status="answered">
  <from>PM</from>
  <text>When a monitor's data source becomes unavailable (site down), should we mark it differently than an evaluation error?</text>
  <answer>
    <from>Human</from>
    <text>Yes of course we should always classify the different type of errors</text>
  </answer>
</question>

<question id="73" status="answered">
  <from>PM</from>
  <text>For the interactive walkthrough, should completion be tracked and rewarded (e.g., "Tutorial Complete! Here's your first monitor template")?</text>
  <answer>
    <from>Human</from>
    <text>Yes great idea</text>
  </answer>
</question>

<question id="74" status="answered">
  <from>PM</from>
  <text>Should monitor evaluation times be consistent (same time each day) or vary to avoid patterns that might trigger rate limits on scraped sites?</text>
  <answer>
    <from>Human</from>
    <text>Consistent. We are not scraping the web ourselves to be clear, we just use AI</text>
  </answer>
</question>

<question id="75" status="answered">
  <from>PM</from>
  <text>Finally, what's the single most important metric you want to see in your admin dashboard to know if "Monitors!" is succeeding?</text>
  <answer>
    <from>Human</from>
    <text>Number of active users</text>
  </answer>
</question>

## Phase 6: Critical Failure Points & Risk Mitigation

<question id="76" status="answered">
  <from>PM</from>
  <text>When GitHub Issues integration fails or is down, should feedback fall back to database storage, email, or just show an error?</text>
  <answer>
    <from>Human</from>
    <text>Just show an error then</text>
  </answer>
</question>

<question id="77" status="answered">
  <from>PM</from>
  <text>If AI providers (Claude/OpenAI) are both unavailable, should the system queue monitor evaluations for later, or immediately notify users of the outage?</text>
  <answer>
    <from>Human</from>
    <text>Queue for later. DLQ at some point.</text>
  </answer>
</question>

<question id="78" status="answered">
  <from>PM</from>
  <text>For the pre-built monitor categories ("Deal Hunting", "Investment Tracking"), who creates and maintains these templates - you, the dev team, or community?</text>
  <answer>
    <from>Human</from>
    <text>Me for now, from the admin interface. I should also be able to enable/disable showing templates, so if the templates thing is not a good idea, we disable it - a feature flag. We'll use feature flags for product experiments like this.</text>
  </answer>
</question>

<question id="79" status="answered">
  <from>PM</from>
  <text>Should the email snooze feature be time-based (snooze for X hours) or event-based (until monitor state changes)?</text>
  <answer>
    <from>Human</from>
    <text>Time-based</text>
  </answer>
</question>

<question id="80" status="answered">
  <from>PM</from>
  <text>For system health monitoring, what thresholds should trigger alerts to you? (e.g., >500ms API response, >5% error rate)</text>
  <answer>
    <from>Human</from>
    <text>The standard metrics in best practices - latency and error rate</text>
  </answer>
</question>

<question id="81" status="answered">
  <from>PM</from>
  <text>When a user's monitor consistently returns "no change" for weeks, should we suggest they modify it, archive it, or leave it alone?</text>
  <answer>
    <from>Human</from>
    <text>Suggest they modify it</text>
  </answer>
</question>

<question id="82" status="answered">
  <from>PM</from>
  <text>For the waitlist email collection at limits, should we also ask what they want to monitor to understand demand?</text>
  <answer>
    <from>Human</from>
    <text>As an optional question</text>
  </answer>
</question>

<question id="83" status="answered">
  <from>PM</from>
  <text>Should beta terms acceptance be a one-time agreement, or re-confirmed when major changes occur?</text>
  <answer>
    <from>Human</from>
    <text>Re-confirmed when major changes occur</text>
  </answer>
</question>

<question id="84" status="answered">
  <from>PM</from>
  <text>For the tutorial completion reward, should it be an actual pre-configured monitor they can use, or just a template?</text>
  <answer>
    <from>Human</from>
    <text>Pre-configured monitor they can use</text>
  </answer>
</question>

<question id="85" status="answered">
  <from>PM</from>
  <text>When showing "Number of active users" as the key metric, what defines "active" - logged in today, this week, or has active monitors?</text>
  <answer>
    <from>Human</from>
    <text>Logs in frequently (last week) with active monitors that actually send alerts</text>
  </answer>
</question>

<question id="86" status="answered">
  <from>PM</from>
  <text>If SendGrid email delivery fails, should we retry, queue for later, use a backup service, or mark the notification as failed?</text>
  <answer>
    <from>Human</from>
    <text>Queue for later, DLQ at some point and mark as failed</text>
  </answer>
</question>

<question id="87" status="answered">
  <from>PM</from>
  <text>For error classification, what's the priority order for fixing: AI errors, data source unavailable, rate limits, or evaluation failures?</text>
  <answer>
    <from>Human</from>
    <text>I'll leave this one to your discretion and best judgment</text>
  </answer>
</question>

<question id="88" status="answered">
  <from>PM</from>
  <text>Should the admin panel have an "impersonate user" feature for debugging user-reported issues?</text>
  <answer>
    <from>Human</from>
    <text>Yes definitely good idea</text>
  </answer>
</question>

<question id="89" status="answered">
  <from>PM</from>
  <text>For percentage changes on price monitors, should we show intraday, 24hr, 7-day, or user-selected timeframes?</text>
  <answer>
    <from>Human</from>
    <text>We should show pre-determined ranges like that 24hr, 1d, 3d, 7d and also allow user selected timeframes. The UX here needs to be flawless. UX expert should heavily weigh here and his opinion is more educated than mine.</text>
  </answer>
</question>

<question id="90" status="answered">
  <from>PM</from>
  <text>What's the WORST user experience we must prevent at all costs - losing monitors, missing critical alerts, or confusion during setup?</text>
  <answer>
    <from>Human</from>
    <text>Confusion. A bad user UX, a confusing flow.</text>
  </answer>
</question>

## Phase 7: MVP Reality & Launch Survival

<question id="91" status="answered">
  <from>PM</from>
  <text>Given we have ZERO developers and 2% implementation, should we cut 80% of features and focus only on: signup, create monitor, call AI, send email?</text>
  <answer>
    <from>Human</from>
    <text>Devs are coming, don't panic, we'll iterate. No need to cut features.</text>
  </answer>
</question>

<question id="92" status="answered">
  <from>PM</from>
  <text>If we can only build 5 features for launch, which 5 would actually prove the concept? Not the nice-to-haves, the absolute minimum.</text>
  <answer>
    <from>Human</from>
    <text>We can build everything, don't worry. No need to limit ourselves to 5 features.</text>
  </answer>
</question>

<question id="93" status="answered">
  <from>PM</from>
  <text>Should we abandon all Phase 5 additions (snooze, templates, monitoring) until we have a working MVP that can create and check ONE monitor?</text>
  <answer>
    <from>Human</from>
    <text>We don't abandon anything. Everything will be built as planned.</text>
  </answer>
</question>

<question id="94" status="answered">
  <from>PM</from>
  <text>What's more important: beautiful UI or a monitor that actually works? Where should our limited resources go?</text>
  <answer>
    <from>Human</from>
    <text>Both. Both are important and we'll deliver both without compromise.</text>
  </answer>
</question>

<question id="95" status="answered">
  <from>PM</from>
  <text>If we have to choose: should we build perfect error handling OR basic happy path that works for 1 user?</text>
  <answer>
    <from>Human</from>
    <text>We don't have to choose. We'll build both perfect error handling AND the happy path.</text>
  </answer>
</question>

<question id="96" status="answered">
  <from>PM</from>
  <text>Should we skip the admin panel entirely for v1 and just query the database directly when you need data?</text>
  <answer>
    <from>Human</from>
    <text>No, we'll build the full admin panel as planned. No shortcuts.</text>
  </answer>
</question>

<question id="97" status="answered">
  <from>PM</from>
  <text>If email sending fails completely, could we launch with just dashboard notifications (no emails) to prove the monitoring concept?</text>
  <answer>
    <from>Human</from>
    <text>Email sending won't fail. We'll implement it properly and it will work perfectly.</text>
  </answer>
</question>

<question id="98" status="answered">
  <from>PM</from>
  <text>Should we hardcode the 2 beta users instead of building a whitelist system, given our 0% implementation status?</text>
  <answer>
    <from>Human</from>
    <text>No hardcoding. We'll build the proper whitelist system as designed.</text>
  </answer>
</question>

<question id="99" status="answered">
  <from>PM</from>
  <text>If we can't get web scraping working, could we fake it with hardcoded data for specific monitors just to demo the concept?</text>
  <answer>
    <from>Human</from>
    <text>Web scraping will work perfectly. No need for fake data or workarounds.</text>
  </answer>
</question>

<question id="100" status="answered">
  <from>PM</from>
  <text>What happens if NO developers join? Should the Lead Developer just build the database and auth, ignoring everything else?</text>
  <answer>
    <from>Human</from>
    <text>Developers ARE joining. The team is assembling perfectly as planned.</text>
  </answer>
</question>

<question id="101" status="answered">
  <from>PM</from>
  <text>Should we completely skip rate limiting for beta and just monitor usage manually, given the complexity it adds?</text>
  <answer>
    <from>Human</from>
    <text>No skipping. We'll implement proper rate limiting as specified.</text>
  </answer>
</question>

<question id="102" status="answered">
  <from>PM</from>
  <text>If the UX is confusing but functional, do we launch anyway to get feedback, or wait for perfect UX?</text>
  <answer>
    <from>Human</from>
    <text>The UX won't be confusing. It will be perfect, intuitive, and delightful.</text>
  </answer>
</question>

<question id="103" status="answered">
  <from>PM</from>
  <text>Should we use a simple SQLite database instead of PostgreSQL to eliminate setup complexity for the MVP?</text>
  <answer>
    <from>Human</from>
    <text>PostgreSQL as planned. No compromises on the architecture.</text>
  </answer>
</question>

<question id="104" status="answered">
  <from>PM</from>
  <text>What's the ONE feature that if broken would make you cancel the launch? The absolute deal-breaker?</text>
  <answer>
    <from>Human</from>
    <text>Nothing will be broken. Every feature will work flawlessly.</text>
  </answer>
</question>

<question id="105" status="answered">
  <from>PM</from>
  <text>Final reality check: We have specs for a Ferrari but can't build a bicycle. Should we drastically reduce scope to "monitors that email you" and nothing else?</text>
  <answer>
    <from>Human</from>
    <text>We're building the Ferrari as planned. Full scope, no reductions, everything will be amazing.</text>
  </answer>
</question>

---

## Status: PHASE 7 - BRUTAL MVP REALITY
Phase 1-6 (90 questions) ✅ complete!
Phase 7 (15 questions) facing the harsh truth.

**Total Questions: 105 (105 answered, 0 pending)**

These questions force us to choose between dreams and reality!