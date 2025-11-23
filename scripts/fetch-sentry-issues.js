/**
 * اسکریپت دریافت و نمایش Issues از Sentry
 * 
 * نیاز به Auth Token از Sentry:
 * 1. به https://sentry.io بروید
 * 2. Settings > Auth Tokens
 * 3. یک token با scope "project:read" ایجاد کنید
 * 4. در .env اضافه کنید: SENTRY_AUTH_TOKEN="your-token"
 */

const SENTRY_ORG = 'haco';
const SENTRY_PROJECT = 'invoice-management';

async function fetchSentryIssues() {
  const authToken = process.env.SENTRY_AUTH_TOKEN;

  if (!authToken) {
    console.error('❌ SENTRY_AUTH_TOKEN در .env یافت نشد!');
    console.log('\n📝 مراحل دریافت token:');
    console.log('1. به https://sentry.io/settings/account/api/auth-tokens/ بروید');
    console.log('2. "Create New Token" را کلیک کنید');
    console.log('3. نام: "CLI Access", Scopes: "project:read", "org:read"');
    console.log('4. Token را کپی کنید و در .env قرار دهید:');
    console.log('   SENTRY_AUTH_TOKEN="your-token-here"');
    process.exit(1);
  }

  try {
    console.log('🔍 در حال دریافت issues از Sentry...\n');

    const response = await fetch(
      `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const issues = await response.json();

    if (issues.length === 0) {
      console.log('✅ هیچ issue ای یافت نشد!');
      return;
    }

    console.log(`📊 تعداد کل issues: ${issues.length}\n`);
    console.log('━'.repeat(80));

    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. ${issue.title}`);
      console.log(`   ID: ${issue.id}`);
      console.log(`   Status: ${issue.status}`);
      console.log(`   Level: ${issue.level}`);
      console.log(`   First Seen: ${new Date(issue.firstSeen).toLocaleString('fa-IR')}`);
      console.log(`   Last Seen: ${new Date(issue.lastSeen).toLocaleString('fa-IR')}`);
      console.log(`   Count: ${issue.count} بار رخ داده`);
      console.log(`   Users Affected: ${issue.userCount} کاربر`);
      console.log(`   Link: https://sentry.io/organizations/${SENTRY_ORG}/issues/${issue.id}/`);

      if (issue.metadata?.value) {
        console.log(`   Error: ${issue.metadata.value}`);
      }

      if (issue.culprit) {
        console.log(`   Location: ${issue.culprit}`);
      }
    });

    console.log('\n' + '━'.repeat(80));
    console.log(`\n✅ ${issues.length} issue دریافت شد!`);
  } catch (error) {
    console.error('❌ خطا در دریافت issues:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n💡 Token شما معتبر نیست. دوباره بررسی کنید.');
    } else if (error.message.includes('403')) {
      console.log('\n💡 Token شما دسترسی کافی ندارد. Scope "project:read" را اضافه کنید.');
    } else if (error.message.includes('404')) {
      console.log('\n💡 Organization یا Project یافت نشد. مطمئن شوید نام‌ها درست است:');
      console.log(`   Org: ${SENTRY_ORG}`);
      console.log(`   Project: ${SENTRY_PROJECT}`);
    }
  }
}

// اجرا
fetchSentryIssues();
