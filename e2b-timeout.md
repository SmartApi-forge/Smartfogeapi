<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Here's how to make your E2B-powered Next.js (or similar stack) preview persistent across user sessions so that previews reliably resume—even after the user has left and returned—within the limits of the E2B Hobby Plan:

Understanding E2B Hobby Plan Persistence
Max Lifetime: On the Hobby plan, an E2B sandbox can live for up to 1 hour (3,600 seconds).[e2b+1](https://e2b.dev/docs/sdk-reference/desktop-python-sdk/v1.7.4/sandbox)​
Timeouts: Sandboxes auto-pause (not terminate) after their timeout; you can set the timeout up to the plan's max.
Persistence: If you explicitly call betaPause, both the filesystem and memory/process state are serialized. The sandbox can later be rehydrated using connect(sandboxId), restoring all data and running processes.[e2b](https://e2b.dev/docs/sandbox/persistence)​
Killed Sandboxes: If the sandbox is killed (timeout expiry or manual kill), you CANNOT resume it; a new one must be created and re-setup from disk state or build cache.[e2b](https://e2b.dev/docs/sandbox/persistence)​

What You Want (UX Recap)
If the user leaves, the running server (Next.js app) is paused, not killed.
When returning, the app preview is instantly resumed (without fresh build if possible).
If the sandbox is not found (killed by timeout), a new sandbox is spun up, and the preview flow starts anew, ideally warm from cache.

How to Achieve This

1. Store the sandboxId and Preview URL Persistently
After creating and starting the sandbox, save the sandboxId, port, and preview URL in your database, linked to the project and user.
2. Auto-Pause for Inactivity, Not Auto-Kill
When a session is idle or the user leaves:
Call await sbx.betaPause() to pause (not kill). This preserves the running preview server, files, and memory.[e2b](https://e2b.dev/docs/sandbox/persistence)​
When the user returns:
Attempt await Sandbox.connect(sandboxId) (which resumes if paused).[e2b](https://e2b.dev/docs/sandbox/persistence)​
3. Handling the "Sandbox Not Found" Case
If connect(sandboxId) throws NotFoundError, the sandbox has expired (over 1 hour old or manually killed).
In this case:
Create a new sandbox from your Docker template.
Restore the project source files and re-run install/build/preview.
Forward the user to a fresh preview URL.
4. Keep Preview Fast on Restart
Use the E2B Docker template to pre-bake dependencies/tools so install/build steps are quick.[e2b](https://e2b.dev/docs/sandbox-template)​
Store any relevant build caches in a /home/user/.cache/ volume if possible, and sync to project storage on kill/restart.
On a resumed sandbox, if the preview port is missing, programmatically rerun npm run dev or next start to bring up the preview.
5. Recommended Logic (Pseudo-code)
typescript
/**

* When user requests feature preview...
*/
async function getOrResumeSandbox(userId, projectId) {
const { sandboxId, previewUrl } = db.getSession(userId, projectId);

if (sandboxId) {
try {
// Try to reconnect to old sandbox (auto-resumes if paused)
const sbx = await Sandbox.connect(sandboxId, {timeoutMs: 3600 * 1000});
// Optionally, `sbx.getInfo()` and check port/service health here
await sbx.setTimeout(3600 * 1000); // Extend if user is now active
return { sbx, url: previewUrl };
} catch (e) {
if (!e.message.includes("NotFound")) throw e;
// Not found: sandbox expired
}
}

// Start fresh sandbox from template, install/build/preview as before
const sbx = await Sandbox.create({ template, timeoutMs: 3600 * 1000 });
// (re)install, build, run preview server
const previewUrl = /* start dev server logic */;
db.saveSession(userId, projectId, { sandboxId: sbx.sandboxId, previewUrl });
return { sbx, url: previewUrl };
}

User Flow on Your Frontend
When a user accesses their preview, always fetch the persistent sandboxId and preview URL.
Attempt reload via pause/resume if the sandbox isn't running.
If the sandbox is not found (over 1h since creation, or idle timeout elapsed plus deletion), start a new sandbox and retry (inform the user if a "cold" start is happening).

Limitations to Convey to Users (Hobby Plan)
Maximum preview reuse time is 1 hour; longer projects will need to re-preview from scratch after expiry.[e2b+1](https://e2b.dev/docs/sdk-reference/js-sdk/v1.1.1/sandbox)​
If the sandbox is paused, restoring is instant and preserves app state.
If the sandbox expired, a fresh preview/build is needed (optimize with build caches and Docker template).[e2b](https://e2b.dev/docs/sandbox-template)​

Summary Table
ScenarioPersistence?User Experience
Returns within 1 hour (paused)
YES (betaPause)
Preview resumes instantly
Returns after >1 hour
NO (killed)
Preview rebuilds
User closes/disconnects
YES (if betaPause)
Can resume if within timeout
Inactive with autoTimeout
YES (autopause)
Can resume if within timeout

Bonus: Use Inngest for Automated Clean-up/Keep-Alive
Use Inngest to run scheduled jobs (e.g., clean up expired sandboxes, auto-pause sandboxes after inactivity, send notifications).
If you want to keep a sandbox alive while a user is clearly active, set a setTimeout heartbeat on interaction to push timeout forward.[e2b+1](https://e2b.dev/docs/sandbox)​

References
E2B Sandboxes: Pause \& Resume, State, Timeouts \& Persistence[e2b+2](https://e2b.dev/docs/sdk-reference/desktop-python-sdk/v1.7.4/sandbox)​
E2B Docker Template \& Snapshots for Fast Startups[e2b](https://e2b.dev/docs/sandbox-template)​
Example sandbox management code ("betaPause", "connect", "setTimeout", etc.)[e2b](https://e2b.dev/docs/sandbox/persistence)​

This persistence and preview refresh pattern is currently the best-possible user experience on E2B Hobby. For longer sandboxes (up to 24h), consider upgrading to Pro.[e2b+1](https://e2b.dev/docs/sdk-reference/js-sdk/v1.1.1/sandbox)​
[https://e2b.dev/docs/sdk-reference/desktop-python-sdk/v1.7.4/sandbox](https://e2b.dev/docs/sdk-reference/desktop-python-sdk/v1.7.4/sandbox)
[https://e2b.dev/docs/sdk-reference/js-sdk/v1.1.1/sandbox](https://e2b.dev/docs/sdk-reference/js-sdk/v1.1.1/sandbox)
[https://e2b.dev/docs/sandbox/persistence](https://e2b.dev/docs/sandbox/persistence)
[https://e2b.dev/docs/sandbox-template](https://e2b.dev/docs/sandbox-template)
[https://e2b.dev/docs/sandbox](https://e2b.dev/docs/sandbox)
[https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/81545804/9e18b8b2-bc8d-48dd-8896-3582d82a778b/image.jpg?AWSAccessKeyId=ASIA2F3EMEYE4ZSCUI2V\&Signature=yC0XMh7m%2FMHlG%2F2e8GUTpniHTMs%3D\&x-amz-security-token=IQoJb3JpZ2luX2VjEHQaCXVzLWVhc3QtMSJHMEUCIQDDdAYSugRJBOi3g0jGvhkLwTWVzsipwO0PaP2qAo%2FDrwIgdAy7H364%2Bo4X21pXJxRr3Ut5RLBwuNXEKqsE2CLKCvkq8QQILBABGgw2OTk3NTMzMDk3MDUiDBC9qX4KUe1QEulauCrOBNGCNjVOwruZSDWS6S2lGUsjedZUfVDODn9JHDMYh2Wv79zLlRvRCqRxNXfhDS%2B4sFLMYXTCSVzGP23%2Bcgpa81ypBzUntFR2AgmgQ81ye2Ty2SkcS0zayD5mTyhGPkmQBdE%2FddB4qcvebDoMfZ2Oi9y%2FQry%2FIWtZ%2FeeNR3At9RykW%2F8%2B%2F%2BsT5aE1EZnEEEekNwmI9nAdDGovcVW7IjMjthMSVtU7A3%2BwBg9gcvPW912n5PO2ww%2F5gpaorHLzqlIsedjOj4OwG3S3%2Bhr5Eot0e%2BPE5Odn6CJDfwtAl2YQUt9AoOXUQ53CJ%2BH7%2B2Ef%2BX9Qx4jngrg%2F4pBZ32y5wxZZYL8OQbm%2Bv1M8HMDxbNLCTXBGOefnFHvyi0X4zObsXOLtPfgTaLREQaCycP2mE4wDF91dxm8%2FHcSCG4V%2BBD8xuXeBce8hTDJWEgyOEDQazEPF89X64xeqLJXbWml5dYvVJ66d%2Bk3skgxkr65wrDYQHWEqH9Y9QzXVjgQR9CGNWWg30%2Fg%2BhgUvKDcZ2oq%2BeE%2BRLSOrCSaHhaLeXgWN%2F9Se3MkyFOTiPjNwyVjHkHEg1IxSybvyiVlJJDd%2FL1hC1fY4dNiOtOgryKsFDDWfl47z2G5eY%2B9idGCurS5wkum78OkjAFU%2F8Fppzx4od9mNVx4c3Tocka13itL%2BnnbkEBFoQb940hDmcUmPY41vFpTqp5VrIAMKvIH6qQgkfn9xUsBvbmA5yqkInC2vxrdR3iEkpJ%2Fjuyrmk8a2HS29lrpixsBAri%2B8%2B5DxlrBwpWlZIkRlMOv44scGOpoB7ABOt5%2FKl9dMPV873Yv4rvpd1abY2NGTQAA4765ReZ7ynTfFyhBOumi4NEPJR4yRuuvmQJwpC2iph1Meoo6JKQauRhXR8W79H2c8y7OjmhbBHVIjB6wctGBXj4Zbe2tqZAwkYdtWO8gK1JUJQdH0bL2AIIcwhj%2F3I%2BHYZ%2F6kFJcZqq4cYhi1VEZU5z6BDqE%2FCteTP%2FfEozQ66Q%3D%3D\&Expires=1761134255](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/81545804/9e18b8b2-bc8d-48dd-8896-3582d82a778b/image.jpg?AWSAccessKeyId=ASIA2F3EMEYE4ZSCUI2V&Signature=yC0XMh7m%2FMHlG%2F2e8GUTpniHTMs%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHQaCXVzLWVhc3QtMSJHMEUCIQDDdAYSugRJBOi3g0jGvhkLwTWVzsipwO0PaP2qAo%2FDrwIgdAy7H364%2Bo4X21pXJxRr3Ut5RLBwuNXEKqsE2CLKCvkq8QQILBABGgw2OTk3NTMzMDk3MDUiDBC9qX4KUe1QEulauCrOBNGCNjVOwruZSDWS6S2lGUsjedZUfVDODn9JHDMYh2Wv79zLlRvRCqRxNXfhDS%2B4sFLMYXTCSVzGP23%2Bcgpa81ypBzUntFR2AgmgQ81ye2Ty2SkcS0zayD5mTyhGPkmQBdE%2FddB4qcvebDoMfZ2Oi9y%2FQry%2FIWtZ%2FeeNR3At9RykW%2F8%2B%2F%2BsT5aE1EZnEEEekNwmI9nAdDGovcVW7IjMjthMSVtU7A3%2BwBg9gcvPW912n5PO2ww%2F5gpaorHLzqlIsedjOj4OwG3S3%2Bhr5Eot0e%2BPE5Odn6CJDfwtAl2YQUt9AoOXUQ53CJ%2BH7%2B2Ef%2BX9Qx4jngrg%2F4pBZ32y5wxZZYL8OQbm%2Bv1M8HMDxbNLCTXBGOefnFHvyi0X4zObsXOLtPfgTaLREQaCycP2mE4wDF91dxm8%2FHcSCG4V%2BBD8xuXeBce8hTDJWEgyOEDQazEPF89X64xeqLJXbWml5dYvVJ66d%2Bk3skgxkr65wrDYQHWEqH9Y9QzXVjgQR9CGNWWg30%2Fg%2BhgUvKDcZ2oq%2BeE%2BRLSOrCSaHhaLeXgWN%2F9Se3MkyFOTiPjNwyVjHkHEg1IxSybvyiVlJJDd%2FL1hC1fY4dNiOtOgryKsFDDWfl47z2G5eY%2B9idGCurS5wkum78OkjAFU%2F8Fppzx4od9mNVx4c3Tocka13itL%2BnnbkEBFoQb940hDmcUmPY41vFpTqp5VrIAMKvIH6qQgkfn9xUsBvbmA5yqkInC2vxrdR3iEkpJ%2Fjuyrmk8a2HS29lrpixsBAri%2B8%2B5DxlrBwpWlZIkRlMOv44scGOpoB7ABOt5%2FKl9dMPV873Yv4rvpd1abY2NGTQAA4765ReZ7ynTfFyhBOumi4NEPJR4yRuuvmQJwpC2iph1Meoo6JKQauRhXR8W79H2c8y7OjmhbBHVIjB6wctGBXj4Zbe2tqZAwkYdtWO8gK1JUJQdH0bL2AIIcwhj%2F3I%2BHYZ%2F6kFJcZqq4cYhi1VEZU5z6BDqE%2FCteTP%2FfEozQ66Q%3D%3D&Expires=1761134255)
[https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/81545804/a2c59d8f-b4f6-4522-8d34-56aa6f8fa512/image.jpg?AWSAccessKeyId=ASIA2F3EMEYE4ZSCUI2V\&Signature=2rFtPb5QQnBeE2nxCfth1q6nvtQ%3D\&x-amz-security-token=IQoJb3JpZ2luX2VjEHQaCXVzLWVhc3QtMSJHMEUCIQDDdAYSugRJBOi3g0jGvhkLwTWVzsipwO0PaP2qAo%2FDrwIgdAy7H364%2Bo4X21pXJxRr3Ut5RLBwuNXEKqsE2CLKCvkq8QQILBABGgw2OTk3NTMzMDk3MDUiDBC9qX4KUe1QEulauCrOBNGCNjVOwruZSDWS6S2lGUsjedZUfVDODn9JHDMYh2Wv79zLlRvRCqRxNXfhDS%2B4sFLMYXTCSVzGP23%2Bcgpa81ypBzUntFR2AgmgQ81ye2Ty2SkcS0zayD5mTyhGPkmQBdE%2FddB4qcvebDoMfZ2Oi9y%2FQry%2FIWtZ%2FeeNR3At9RykW%2F8%2B%2F%2BsT5aE1EZnEEEekNwmI9nAdDGovcVW7IjMjthMSVtU7A3%2BwBg9gcvPW912n5PO2ww%2F5gpaorHLzqlIsedjOj4OwG3S3%2Bhr5Eot0e%2BPE5Odn6CJDfwtAl2YQUt9AoOXUQ53CJ%2BH7%2B2Ef%2BX9Qx4jngrg%2F4pBZ32y5wxZZYL8OQbm%2Bv1M8HMDxbNLCTXBGOefnFHvyi0X4zObsXOLtPfgTaLREQaCycP2mE4wDF91dxm8%2FHcSCG4V%2BBD8xuXeBce8hTDJWEgyOEDQazEPF89X64xeqLJXbWml5dYvVJ66d%2Bk3skgxkr65wrDYQHWEqH9Y9QzXVjgQR9CGNWWg30%2Fg%2BhgUvKDcZ2oq%2BeE%2BRLSOrCSaHhaLeXgWN%2F9Se3MkyFOTiPjNwyVjHkHEg1IxSybvyiVlJJDd%2FL1hC1fY4dNiOtOgryKsFDDWfl47z2G5eY%2B9idGCurS5wkum78OkjAFU%2F8Fppzx4od9mNVx4c3Tocka13itL%2BnnbkEBFoQb940hDmcUmPY41vFpTqp5VrIAMKvIH6qQgkfn9xUsBvbmA5yqkInC2vxrdR3iEkpJ%2Fjuyrmk8a2HS29lrpixsBAri%2B8%2B5DxlrBwpWlZIkRlMOv44scGOpoB7ABOt5%2FKl9dMPV873Yv4rvpd1abY2NGTQAA4765ReZ7ynTfFyhBOumi4NEPJR4yRuuvmQJwpC2iph1Meoo6JKQauRhXR8W79H2c8y7OjmhbBHVIjB6wctGBXj4Zbe2tqZAwkYdtWO8gK1JUJQdH0bL2AIIcwhj%2F3I%2BHYZ%2F6kFJcZqq4cYhi1VEZU5z6BDqE%2FCteTP%2FfEozQ66Q%3D%3D\&Expires=1761134255](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/81545804/a2c59d8f-b4f6-4522-8d34-56aa6f8fa512/image.jpg?AWSAccessKeyId=ASIA2F3EMEYE4ZSCUI2V&Signature=2rFtPb5QQnBeE2nxCfth1q6nvtQ%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHQaCXVzLWVhc3QtMSJHMEUCIQDDdAYSugRJBOi3g0jGvhkLwTWVzsipwO0PaP2qAo%2FDrwIgdAy7H364%2Bo4X21pXJxRr3Ut5RLBwuNXEKqsE2CLKCvkq8QQILBABGgw2OTk3NTMzMDk3MDUiDBC9qX4KUe1QEulauCrOBNGCNjVOwruZSDWS6S2lGUsjedZUfVDODn9JHDMYh2Wv79zLlRvRCqRxNXfhDS%2B4sFLMYXTCSVzGP23%2Bcgpa81ypBzUntFR2AgmgQ81ye2Ty2SkcS0zayD5mTyhGPkmQBdE%2FddB4qcvebDoMfZ2Oi9y%2FQry%2FIWtZ%2FeeNR3At9RykW%2F8%2B%2F%2BsT5aE1EZnEEEekNwmI9nAdDGovcVW7IjMjthMSVtU7A3%2BwBg9gcvPW912n5PO2ww%2F5gpaorHLzqlIsedjOj4OwG3S3%2Bhr5Eot0e%2BPE5Odn6CJDfwtAl2YQUt9AoOXUQ53CJ%2BH7%2B2Ef%2BX9Qx4jngrg%2F4pBZ32y5wxZZYL8OQbm%2Bv1M8HMDxbNLCTXBGOefnFHvyi0X4zObsXOLtPfgTaLREQaCycP2mE4wDF91dxm8%2FHcSCG4V%2BBD8xuXeBce8hTDJWEgyOEDQazEPF89X64xeqLJXbWml5dYvVJ66d%2Bk3skgxkr65wrDYQHWEqH9Y9QzXVjgQR9CGNWWg30%2Fg%2BhgUvKDcZ2oq%2BeE%2BRLSOrCSaHhaLeXgWN%2F9Se3MkyFOTiPjNwyVjHkHEg1IxSybvyiVlJJDd%2FL1hC1fY4dNiOtOgryKsFDDWfl47z2G5eY%2B9idGCurS5wkum78OkjAFU%2F8Fppzx4od9mNVx4c3Tocka13itL%2BnnbkEBFoQb940hDmcUmPY41vFpTqp5VrIAMKvIH6qQgkfn9xUsBvbmA5yqkInC2vxrdR3iEkpJ%2Fjuyrmk8a2HS29lrpixsBAri%2B8%2B5DxlrBwpWlZIkRlMOv44scGOpoB7ABOt5%2FKl9dMPV873Yv4rvpd1abY2NGTQAA4765ReZ7ynTfFyhBOumi4NEPJR4yRuuvmQJwpC2iph1Meoo6JKQauRhXR8W79H2c8y7OjmhbBHVIjB6wctGBXj4Zbe2tqZAwkYdtWO8gK1JUJQdH0bL2AIIcwhj%2F3I%2BHYZ%2F6kFJcZqq4cYhi1VEZU5z6BDqE%2FCteTP%2FfEozQ66Q%3D%3D&Expires=1761134255)
[https://novita.ai/docs/guides/sandbox-persistence](https://novita.ai/docs/guides/sandbox-persistence)
[https://nextjs.org/docs/pages/guides/preview-mode](https://nextjs.org/docs/pages/guides/preview-mode)
[https://github.com/e2b-dev/open-computer-use/issues/31](https://github.com/e2b-dev/open-computer-use/issues/31)
[https://www.reddit.com/r/nextjs/comments/1enldam/what_would_be_the_best_way_to_persist_user/](https://www.reddit.com/r/nextjs/comments/1enldam/what_would_be_the_best_way_to_persist_user/)
[https://github.com/e2b-dev/e2b/issues/884](https://github.com/e2b-dev/e2b/issues/884)
[https://stackoverflow.com/questions/62099286/persist-data-between-two-pages-with-next-js](https://stackoverflow.com/questions/62099286/persist-data-between-two-pages-with-next-js)
[https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers](https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers)
[https://www.sanity.io/answers/next-js-preview-mode-showing-old-content](https://www.sanity.io/answers/next-js-preview-mode-showing-old-content)
[https://thesequence.substack.com/p/the-sequence-ai-of-the-week-698-how](https://thesequence.substack.com/p/the-sequence-ai-of-the-week-698-how)
[https://rn.veevavault.help/en/gr/archive/24r2/known-issues-in-24r2-release/](https://rn.veevavault.help/en/gr/archive/24r2/known-issues-in-24r2-release/)
[https://dev.to/chenni/how-to-persist-components-between-pages-in-nextjs-and-why-it-works-1hg8](https://dev.to/chenni/how-to-persist-components-between-pages-in-nextjs-and-why-it-works-1hg8)
[https://github.com/e2b-dev/desktop](https://github.com/e2b-dev/desktop)
[https://www.linkedin.com/posts/ujwalakrishna_opensource-ai-llm-activity-7364404438855282688-Wh15](https://www.linkedin.com/posts/ujwalakrishna_opensource-ai-llm-activity-7364404438855282688-Wh15)
[https://github.com/vercel/next.js/issues/2252](https://github.com/vercel/next.js/issues/2252)
[https://dev.to/copilotkit/30-mcp-ideas-with-complete-source-code-d8e](https://dev.to/copilotkit/30-mcp-ideas-with-complete-source-code-d8e), so to keep the sandbox uptime to 1hr what should we do in code check the e2b docs or all other related resources and tell me how will i do in my next js project!

Here’s exactly how to keep your E2B sandbox alive for the **maximum 1 hour** allowed on the Hobby plan in your **Next.js project**, based on official E2B docs and best practices:

***

## **1. Set Maximum Timeout When Creating the Sandbox**

When you create a sandbox, specify `timeoutMs: 3600_000` (1 hour in milliseconds):

```typescript
import { Sandbox } from "@e2b/code-interpreter";

const sandbox = await Sandbox.create({
  template: "your-template-id",
  timeoutMs: 3600_000, // 1 hour = 3,600,000 ms
  // If using beta features:
  // autoPause: true,
});
```

- **Default timeout** is usually 5 or 10 minutes, so you must override it for full 1 hour.[^1][^2][^3]

***

## **2. Extend or Refresh Timeout on Each User Activity**

If users interact with the preview (mouse, keypress, HTTP request, etc.), call `.setTimeout` to reset the timeout back to 1 hour **from now**:

```typescript
await sandbox.setTimeout(3600_000); // Reset to 1 hour from *current* moment
```

- Each call extends the life window for another hour.[^4][^5][^1]
- If your app is interactive, you can call this on every "heartbeat" or API ping from the user session.

***

## **3. On Every Resume/Connection, Always Pass the Timeout**

When you **reconnect** or resume a paused sandbox (e.g., after user returns), pass the timeout parameter:

```typescript
const resumed = await Sandbox.connect(sandboxId, {
  timeoutMs: 3600_000
});
```

- This ensures it gets 1 hour from the point the user comes back, not from original start.[^3]

***

## **4. (Optional) Use Auto-pause/Resume for User Sessions**

With E2B’s beta persistence, you can `.betaPause()` when the user leaves, and resume with `.connect(sandboxId)`, setting `timeoutMs: 3600_000` on connect:

```typescript
await sandbox.betaPause();              // When session goes idle
await Sandbox.connect(sandboxId, {      // When user returns
  timeoutMs: 3600_000
});
```

- Auto-pause is more about saving compute, not extending total max lifetime (still capped at 1 hour on Hobby).[^3]

***

## **5. Monitor and Inform User About Expiry**

Check sandbox expiry time using:

```typescript
const info = await sandbox.getInfo();
console.log(info.endAt); // ISO string of expected kill time
```

If you approach or hit expiry (i.e., `.connect` throws NotFound), start a **fresh sandbox** and reload/copy the project.

***

## **TL;DR Implementation Plan**

**When creating or resuming a sandbox:**

- Always specify `timeoutMs: 3600_000` (1 hour).[^2][^1][^4]
- On *every* user interaction, call `setTimeout(3600_000)`.[^1][^4]
- Use `getInfo()` to get the expiration time and warn users if the sandbox will soon expire.
- If you hit expiration, rebuild the sandbox with the template and copy code as needed.

***

## **Sample Workflow for Next.js API Route**

```typescript
// pages/api/e2b-sandbox.ts
import { Sandbox } from "@e2b/code-interpreter";

export default async function handler(req, res) {
  let { sandboxId } = req.body;

  let sandbox;
  if (!sandboxId) {
    sandbox = await Sandbox.create({
      template: "your-template-id",
      timeoutMs: 3600_000,
    });
    // Store sandbox.sandboxId for user/project
  } else {
    try {
      sandbox = await Sandbox.connect(sandboxId, { timeoutMs: 3600_000 });
    } catch (err) {
      // Sandbox not found = expired, restart
      sandbox = await Sandbox.create({
        template: "your-template-id",
        timeoutMs: 3600_000,
      });
    }
    // Call this on each session ping as a keep-alive
    await sandbox.setTimeout(3600_000);
  }

  // ...other sandbox logic...
  res.status(200).json({ sandboxId: sandbox.sandboxId });
}
```


***

## **Key E2B References**

- [Sandbox JS SDK - setTimeout](https://e2b.dev/docs/sdk-reference/js-sdk/v1.0.1/sandbox)[^6][^2][^4][^1][^3]
- [Sandbox Persistence \& AutoPause](https://e2b.dev/docs/sandbox/persistence)[^3]
- [Sandbox Lifecycle Docs (default 5 min, can set to 1h)](https://e2b.dev/docs/sandbox)[^1]
- [More examples in E2B docs](https://e2b.dev/docs)[^7]

***

## **Summary Table**

| Action | Code | Notes |
| :-- | :-- | :-- |
| Set max timeout on create | `Sandbox.create({timeoutMs: 3600_000})` | Hobby = max 1h |
| Extend timeout (heartbeat) | `sandbox.setTimeout(3600_000)` | Call on every user action |
| On resume/connect | `Sandbox.connect(sandboxId, {timeoutMs: 3600_000})` | Always re-set timeout |
| Get expiry info | `sandbox.getInfo()` | Use `endAt` for warnings |
| Auto-pause | `sandbox.betaPause()` / `Sandbox.connect()` | Saves state |

With this, your sandboxes will always live up to the **maximum 1 hour allowed for Hobby plan**, and users get the best uptime.[^6][^2][^4][^1][^3]

If you ever need **longer-lived sandboxes (24h+)**, you must upgrade to the Pro plan.[^8][^9][^6]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://e2b.dev/docs/sandbox

[^2]: https://novita.ai/docs/guides/sandbox-e2b-sandbox

[^3]: https://e2b.dev/docs/sandbox/persistence

[^4]: https://e2b.dev/docs/sdk-reference/js-sdk/v1.5.3/sandbox

[^5]: https://github.com/e2b-dev/E2B/issues/592

[^6]: https://e2b.dev/docs/sdk-reference/js-sdk/v1.0.1/sandbox

[^7]: https://e2b.dev/docs

[^8]: https://e2b.dev/docs/sdk-reference/desktop-python-sdk/v2.0.1/sandbox

[^9]: https://e2b.dev/docs/sdk-reference/js-sdk/v1.9.1/sandbox

[^10]: https://e2b.dev/docs/sandbox/rate-limits

[^11]: https://e2b.dev/docs/sdk-reference/python-sdk/v1.0.0/sandbox_sync

[^12]: https://e2b.dev/docs/sdk-reference/python-sdk/v1.5.0/sandbox_sync

[^13]: https://northflank.com/blog/best-alternatives-to-e2b-dev-for-running-untrusted-code-in-secure-sandboxes

[^14]: https://e2b.dev/docs/sdk-reference/python-sdk/v2.3.3/sandbox_sync

[^15]: https://github.com/e2b-dev/desktop/issues/102

[^16]: https://e2b.dev/blog/python-guide-run-claude-code-in-an-e2b-sandbox

[^17]: https://e2b.dev/docs/sandbox/lifecycle-events-api

[^18]: https://github.com/e2b-dev/surf

[^19]: https://www.latent.space/p/e2b

[^20]: https://github.com/agno-agi/agno/issues/4321

