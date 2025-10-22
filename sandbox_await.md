<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# and also how do i make the e2b sandbox to run the application like next js which gets timed out faster and becomes not found, when the user leaves the project and opens the same project it should show the same preview that is sandbox should refresh and show the same preview of the sandbox in my application like attached image. we are in hobby plan and how if i can restart if the user is not using the project and he come back it should run the application faster and show preview! How can i do that should we do with inngest or anything ?

Here's how to make your E2B-powered Next.js (or similar stack) preview persistent across user sessions so that previews reliably resume—even after the user has left and returned—**within the limits of the E2B Hobby Plan**:

***

## **Understanding E2B Hobby Plan Persistence**

- **Max Lifetime:** On the Hobby plan, an E2B sandbox can live for up to 1 hour (3,600 seconds).[^1][^2]
- **Timeouts:** Sandboxes auto-pause (not terminate) after their timeout; you can set the timeout up to the plan's max.
- **Persistence:** If you explicitly call `betaPause`, both the filesystem *and* memory/process state are serialized. The sandbox can later be rehydrated using `connect(sandboxId)`, restoring all data and running processes.[^3]
- **Killed Sandboxes:** If the sandbox is killed (timeout expiry or manual kill), you **CANNOT resume** it; a new one must be created and re-setup from disk state or build cache.[^3]

***

## **What You Want (UX Recap)**

- If the user leaves, the running server (Next.js app) is paused, *not killed*.
- When returning, the app preview is **instantly** resumed (without fresh build if possible).
- If the sandbox is not found (killed by timeout), a new sandbox is spun up, and the preview flow starts anew, ideally warm from cache.

***

## **How to Achieve This**

### 1. **Store the `sandboxId` and Preview URL Persistently**

After creating and starting the sandbox, save the sandboxId, port, and preview URL in your database, linked to the project and user.

### 2. **Auto-Pause for Inactivity, Not Auto-Kill**

When a session is idle or the user leaves:

- Call `await sbx.betaPause()` to pause (not kill). This preserves the running preview server, files, and memory.[^3]

When the user returns:

- Attempt `await Sandbox.connect(sandboxId)` (which resumes if paused).[^3]


### 3. **Handling the "Sandbox Not Found" Case**

- If `connect(sandboxId)` throws NotFoundError, the sandbox has expired (over 1 hour old or manually killed).
- In this case:
    - Create a new sandbox from your Docker template.
    - Restore the project source files and re-run install/build/preview.
    - Forward the user to a fresh preview URL.


### 4. **Keep Preview Fast on Restart**

- Use the E2B Docker template to pre-bake dependencies/tools so install/build steps are quick.[^4]
- Store any relevant build caches in a `/home/user/.cache/` volume if possible, and sync to project storage on kill/restart.
- On a resumed sandbox, if the preview port is missing, programmatically rerun `npm run dev` or `next start` to bring up the preview.


### 5. **Recommended Logic (Pseudo-code)**

```typescript
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
```


***

## **User Flow on Your Frontend**

- When a user accesses their preview, always fetch the persistent `sandboxId` and preview URL.
- Attempt reload via pause/resume if the sandbox isn't running.
- If the sandbox is not found (over 1h since creation, or idle timeout elapsed plus deletion), start a new sandbox and retry (inform the user if a "cold" start is happening).

***

## **Limitations to Convey to Users (Hobby Plan)**

- **Maximum preview reuse time is 1 hour**; longer projects will need to re-preview from scratch after expiry.[^2][^1]
- If the sandbox is paused, restoring is instant and preserves app state.
- If the sandbox expired, a fresh preview/build is needed (optimize with build caches and Docker template).[^4]

***

## **Summary Table**

| Scenario | Persistence? | User Experience |
| :-- | :-- | :-- |
| Returns within 1 hour (paused) | YES (betaPause) | Preview resumes **instantly** |
| Returns after >1 hour | NO (killed) | Preview **rebuilds** |
| User closes/disconnects | YES (if betaPause) | Can resume if within timeout |
| Inactive with autoTimeout | YES (autopause) | Can resume if within timeout |


***

## **Bonus: Use Inngest for Automated Clean-up/Keep-Alive**

- Use Inngest to run scheduled jobs (e.g., clean up expired sandboxes, auto-pause sandboxes after inactivity, send notifications).
- If you want to keep a sandbox alive while a user is clearly active, set a `setTimeout` heartbeat on interaction to push timeout forward.[^5][^3]

***

## **References**

- E2B Sandboxes: Pause \& Resume, State, Timeouts \& Persistence[^1][^2][^3]
- E2B Docker Template \& Snapshots for Fast Startups[^4]
- Example sandbox management code ("betaPause", "connect", "setTimeout", etc.)[^3]

***

**This persistence and preview refresh pattern is currently the best-possible user experience on E2B Hobby. For longer sandboxes (up to 24h), consider upgrading to Pro**.[^2][^1]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://e2b.dev/docs/sdk-reference/desktop-python-sdk/v1.7.4/sandbox

[^2]: https://e2b.dev/docs/sdk-reference/js-sdk/v1.1.1/sandbox

[^3]: https://e2b.dev/docs/sandbox/persistence

[^4]: https://e2b.dev/docs/sandbox-template

[^5]: https://e2b.dev/docs/sandbox

[^6]: image.jpg

[^7]: image.jpg

[^8]: https://novita.ai/docs/guides/sandbox-persistence

[^9]: https://nextjs.org/docs/pages/guides/preview-mode

[^10]: https://github.com/e2b-dev/open-computer-use/issues/31

[^11]: https://www.reddit.com/r/nextjs/comments/1enldam/what_would_be_the_best_way_to_persist_user/

[^12]: https://github.com/e2b-dev/e2b/issues/884

[^13]: https://stackoverflow.com/questions/62099286/persist-data-between-two-pages-with-next-js

[^14]: https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers

[^15]: https://www.sanity.io/answers/next-js-preview-mode-showing-old-content

[^16]: https://thesequence.substack.com/p/the-sequence-ai-of-the-week-698-how

[^17]: https://rn.veevavault.help/en/gr/archive/24r2/known-issues-in-24r2-release/

[^18]: https://dev.to/chenni/how-to-persist-components-between-pages-in-nextjs-and-why-it-works-1hg8

[^19]: https://github.com/e2b-dev/desktop

[^20]: https://www.linkedin.com/posts/ujwalakrishna_opensource-ai-llm-activity-7364404438855282688-Wh15

[^21]: https://github.com/vercel/next.js/issues/2252

[^22]: https://dev.to/copilotkit/30-mcp-ideas-with-complete-source-code-d8e

