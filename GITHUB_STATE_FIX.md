Based on your error screenshots, you're encountering two key issues when trying to push code to a newly created GitHub repository:

## **Root Causes**

### **1. `TypeError: Cannot read properties of undefined (reading 'sha')`**
This happens because **newly created GitHub repositories have NO branches yet**—not even a default branch. When you call `getBranches()` on an empty repo, it returns an empty array or undefined, causing the `.sha` property access to fail.[1][2][3]

### **2. `401 Unauthorized` on `api.github.com/user/orgs:1`**
This suggests your GitHub access token either:
- Doesn't have the required `repo` and `user` scopes[4][5][6]
- Is expired or invalid[7][4]
- Isn't being passed correctly in the Authorization header[7]

***

## **Solutions**

### **Solution 1: Initialize the Repository Before Pushing Code**

A newly created GitHub repository is **completely empty** (no commits, no branches). You need to create an **initial commit** first before you can push code to it.[2][8][1]

#### **Option A: Create Initial Commit via GitHub API**

```typescript
// In your tRPC mutation for creating repo and pushing code

import { Octokit } from '@octokit/rest';

export const githubRouter = router({
  createAndPushRepository: protectedProcedure
    .input(z.object({
      repoName: z.string(),
      files: z.array(z.object({
        path: z.string(),
        content: z.string(),
      })),
      branch: z.string().default('main'),
    }))
    .mutation(async ({ ctx, input }) => {
      const octokit = new Octokit({
        auth: ctx.user.githubAccessToken,
      });

      try {
        // Step 1: Create the repository
        const repo = await octokit.repos.createForAuthenticatedUser({
          name: input.repoName,
          private: false,
          auto_init: true, // CRITICAL: This creates initial commit with README
        });

        // Wait for GitHub to initialize the repo (sometimes takes 1-2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Get the default branch reference
        const { data: refData } = await octokit.git.getRef({
          owner: repo.data.owner.login,
          repo: repo.data.name,
          ref: `heads/${input.branch}`,
        });

        const commitSha = refData.object.sha;

        // Step 3: Get the base tree
        const { data: commitData } = await octokit.git.getCommit({
          owner: repo.data.owner.login,
          repo: repo.data.name,
          commit_sha: commitSha,
        });

        // Step 4: Create blobs for all files
        const blobs = await Promise.all(
          input.files.map(async (file) => {
            const { data } = await octokit.git.createBlob({
              owner: repo.data.owner.login,
              repo: repo.data.name,
              content: Buffer.from(file.content).toString('base64'),
              encoding: 'base64',
            });
            return {
              path: file.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: data.sha,
            };
          })
        );

        // Step 5: Create a new tree with all files
        const { data: newTree } = await octokit.git.createTree({
          owner: repo.data.owner.login,
          repo: repo.data.name,
          base_tree: commitData.tree.sha,
          tree: blobs,
        });

        // Step 6: Create a new commit
        const { data: newCommit } = await octokit.git.createCommit({
          owner: repo.data.owner.login,
          repo: repo.data.name,
          message: 'Initial commit from SmartAPIForge',
          tree: newTree.sha,
          parents: [commitSha],
        });

        // Step 7: Update the branch reference
        await octokit.git.updateRef({
          owner: repo.data.owner.login,
          repo: repo.data.name,
          ref: `heads/${input.branch}`,
          sha: newCommit.sha,
        });

        return {
          success: true,
          repoUrl: repo.data.html_url,
          cloneUrl: repo.data.clone_url,
        };
      } catch (error) {
        console.error('GitHub API Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),
});
```

***

### **Solution 2: Handle Empty Repository Detection**

Add defensive checks before calling `getBranches()`:

```typescript
// Before trying to get branches
const { data: branches } = await octokit.repos.listBranches({
  owner: ownerName,
  repo: repoName,
});

if (branches.length === 0) {
  // Repository is empty - create initial commit first
  await octokit.repos.createOrUpdateFileContents({
    owner: ownerName,
    repo: repoName,
    path: 'README.md',
    message: 'Initialize repository',
    content: Buffer.from('# ' + repoName).toString('base64'),
  });
  
  // Now branches will exist
}

// Safe to get branches now
const { data: branchData } = await octokit.repos.getBranch({
  owner: ownerName,
  repo: repoName,
  branch: 'main',
});

const commitSha = branchData.commit.sha; // No longer undefined
```

***

### **Solution 3: Fix 401 Unauthorized Error**

#### **Check Token Scopes**

Your GitHub token needs these scopes:[5][4]
- `repo` (full control of private repositories)
- `user` (read user profile data)
- `admin:org` (if accessing organization repos)

#### **Verify Token in Authorization Header**

```typescript
const octokit = new Octokit({
  auth: `token ${accessToken}`, // Use 'token' prefix, NOT 'Bearer'
});

// Or manually set headers
const response = await fetch('https://api.github.com/user/repos', {
  headers: {
    'Authorization': `token ${accessToken}`, // NOT 'Bearer'
    'Accept': 'application/vnd.github.v3+json',
  },
});
```

**Important:** GitHub's REST API uses `token` prefix, not `Bearer`.[7]

***

### **Solution 4: Use `auto_init` When Creating Repository**

The simplest fix—create the repo with an initial commit automatically:

```typescript
const { data: repo } = await octokit.repos.createForAuthenticatedUser({
  name: repoName,
  private: false,
  auto_init: true, // Creates README.md and initial commit automatically
});
```

This ensures the repository has a default branch (`main`) with at least one commit, so `getBranches()` won't return undefined.[3][8]

***

## **Complete Working Example**

```typescript
export const githubRouter = router({
  pushToRepository: protectedProcedure
    .input(z.object({
      repoName: z.string(),
      files: z.array(z.object({ path: z.string(), content: z.string() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const octokit = new Octokit({ auth: ctx.user.githubToken });

      // Create repo with auto_init
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: input.repoName,
        auto_init: true, // Critical!
      });

      // Wait for initialization
      await new Promise(r => setTimeout(r, 2000));

      // Now safe to push files
      for (const file of input.files) {
        await octokit.repos.createOrUpdateFileContents({
          owner: repo.owner.login,
          repo: repo.name,
          path: file.path,
          message: `Add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
        });
      }

      return { repoUrl: repo.html_url };
    }),
});
```

***

## **Key Takeaways**

1. **Never call `getBranches()` on a newly created repo without `auto_init: true`**[8][2][3]
2. **Use `token` prefix in Authorization header, NOT `Bearer`**[7]
3. **Check token scopes include `repo` and `user`**[4][5]
4. **Add a 1-2 second delay after repo creation before pushing code**[8]

This should resolve both the `sha` undefined error and the 401 unauthorized issue.[1][2][3][4][8][7]

[1](https://stackoverflow.com/questions/74197064/git-push-to-create-new-github-repo-not-working)
[2](https://github.com/integrations/terraform-provider-github/issues/577)
[3](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database)
[4](https://stackoverflow.com/questions/72333859/getting-401-unauthorized-error-while-requesting-github-api)
[5](https://community.auth0.com/t/github-api-fetch-repositories-failing-with-401-unauthorized-in-auth0-integration/150442)
[6](https://github.com/orgs/community/discussions/142517)
[7](https://github.com/orgs/community/discussions/118908)
[8](https://www.youtube.com/watch?v=KDEyjlgQySA)
[9](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/81545804/3f6d321b-db4a-4591-9af2-8922ba0d04dd/Screenshot-2025-10-20-231559.jpg?AWSAccessKeyId=ASIA2F3EMEYE4ZY5BXSZ&Signature=fhANNPtH1%2BDaC%2FPgFV1Rrd9PqVI%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEEoaCXVzLWVhc3QtMSJIMEYCIQCQAqo2tHATWkrCcEw999ry4fi%2FJ62pyCyPxGgJOAJdFAIhAKaUNM9Gy6Sp3rHyDTVudcHH8ybTUQ7bDyvgp1TZ1sk6KvoECPP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQARoMNjk5NzUzMzA5NzA1Igzh3rrgdYTA586q3rYqzgQ%2FbWiy1nn4ZCo2sznfgvNK68fE0XHmHVqdzqzIroSK%2BIQ%2F%2Fom3g24mECZcaIfjTExpFnXGCrYeBLe%2FelHkU%2Bl8sfXpHvs2RzyKPePjmXxM669ADOn7jTyxJCUitaZXdHm8Q4FNRB9qx51iHPSmMOjTXxSSAkSJ5t1vxAxgQv5RM%2B7t%2Fkv7TG%2FvojDw5%2FiU9zF1D%2FVS%2BTEMT7m4pjaiHLgq%2FQTg%2F%2BGT2D2tcDDLEdDc%2BT1WxfKCB8NUiWb7XRX9QYxRsBCpspt4K8PmTatyChBlwvgYyVfWsby3zHzwFY5SKWtodJ9C5miSLAZssZkGSW%2BXTTuQQEad2HETvUJCQzQZ1KF2rvATsO6iXyMJZofPHBRVkV66HdudWtvShu%2FgUCcbLdU%2BYK77RbPPnKYrDarohuGEiGEZK0HYp4sf2luzT%2B7i2tRslZq6VIveD%2BaHzukxM2YT7%2B%2FIHDMC1TSJVv%2BLDtH81TidyF%2FBIOMZmDAm5i%2Bd87ueOiQ0TpMSYv5xLSjdkP8%2FLgnBDJjGx58UirDAIgYCiigR6Fx%2BPoekGwLaQWs%2FQ7%2FZjk2GJxKhatFef9t78wfM2gNIE3ot9R1B%2F1aGIHWItgUFyp29ywSVJV%2FikKHfbsd%2Fz8Ne3PdvFIcrYoHp8Z0lk4CzVLpVx%2Fpe0FCRrtaTOHwgoMdthCtE71k7Wot2dQd6YCtaYCLG8vrLeQdEMoOWs%2BGYQmZRBokYEv%2FX%2FtclTR5wBcY6fJcFRQFhDwcOBN%2BG4NZXrwGhE69jvyf%2BqTokY9nf5vgJFazkEzCw4NnHBjqZAUOVdt%2B1ukRBFxtZ5aoPyzYNHIOwiNvFhKoMjBMDIimfzUPtauxJUinK21qNUTesDrWg9DhpjSFIsRCgz6fVfO7%2B8oZkbNCh%2BbTLS07HgKwdQt4xbNwy%2Fao9n9%2F4ctRjNBQDVU8buUqwAEYI08UdkndY7CRnVwNNhtf%2FC7ewnoxQYkxSqmTJcn4zUbqzn6iPzlpem%2FWAU8aIqQ%3D%3D&Expires=1760983985)
[10](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/81545804/a1f9eeec-e074-4753-9f62-84046938b24d/Screenshot-2025-10-20-231619.jpg?AWSAccessKeyId=ASIA2F3EMEYE4ZY5BXSZ&Signature=FRCDvHNUwTRPBaoP8O884hwsvD0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEEoaCXVzLWVhc3QtMSJIMEYCIQCQAqo2tHATWkrCcEw999ry4fi%2FJ62pyCyPxGgJOAJdFAIhAKaUNM9Gy6Sp3rHyDTVudcHH8ybTUQ7bDyvgp1TZ1sk6KvoECPP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQARoMNjk5NzUzMzA5NzA1Igzh3rrgdYTA586q3rYqzgQ%2FbWiy1nn4ZCo2sznfgvNK68fE0XHmHVqdzqzIroSK%2BIQ%2F%2Fom3g24mECZcaIfjTExpFnXGCrYeBLe%2FelHkU%2Bl8sfXpHvs2RzyKPePjmXxM669ADOn7jTyxJCUitaZXdHm8Q4FNRB9qx51iHPSmMOjTXxSSAkSJ5t1vxAxgQv5RM%2B7t%2Fkv7TG%2FvojDw5%2FiU9zF1D%2FVS%2BTEMT7m4pjaiHLgq%2FQTg%2F%2BGT2D2tcDDLEdDc%2BT1WxfKCB8NUiWb7XRX9QYxRsBCpspt4K8PmTatyChBlwvgYyVfWsby3zHzwFY5SKWtodJ9C5miSLAZssZkGSW%2BXTTuQQEad2HETvUJCQzQZ1KF2rvATsO6iXyMJZofPHBRVkV66HdudWtvShu%2FgUCcbLdU%2BYK77RbPPnKYrDarohuGEiGEZK0HYp4sf2luzT%2B7i2tRslZq6VIveD%2BaHzukxM2YT7%2B%2FIHDMC1TSJVv%2BLDtH81TidyF%2FBIOMZmDAm5i%2Bd87ueOiQ0TpMSYv5xLSjdkP8%2FLgnBDJjGx58UirDAIgYCiigR6Fx%2BPoekGwLaQWs%2FQ7%2FZjk2GJxKhatFef9t78wfM2gNIE3ot9R1B%2F1aGIHWItgUFyp29ywSVJV%2FikKHfbsd%2Fz8Ne3PdvFIcrYoHp8Z0lk4CzVLpVx%2Fpe0FCRrtaTOHwgoMdthCtE71k7Wot2dQd6YCtaYCLG8vrLeQdEMoOWs%2BGYQmZRBokYEv%2FX%2FtclTR5wBcY6fJcFRQFhDwcOBN%2BG4NZXrwGhE69jvyf%2BqTokY9nf5vgJFazkEzCw4NnHBjqZAUOVdt%2B1ukRBFxtZ5aoPyzYNHIOwiNvFhKoMjBMDIimfzUPtauxJUinK21qNUTesDrWg9DhpjSFIsRCgz6fVfO7%2B8oZkbNCh%2BbTLS07HgKwdQt4xbNwy%2Fao9n9%2F4ctRjNBQDVU8buUqwAEYI08UdkndY7CRnVwNNhtf%2FC7ewnoxQYkxSqmTJcn4zUbqzn6iPzlpem%2FWAU8aIqQ%3D%3D&Expires=1760983985)
[11](https://github.com/gitpod-io/gitpod/issues/643)
[12](https://github.com/octokit/octokit.net/issues/1102)
[13](https://stackoverflow.com/questions/70427288/git-clone-with-npm-failing)
[14](https://github.com/orgs/community/discussions/68237)
[15](https://stackoverflow.com/questions/67723992/how-to-create-a-branch-using-probot-octokit)
[16](https://github.com/webpack/webpack/issues/15582)
[17](https://www.reddit.com/r/git/comments/18ohkxz/unable_to_push_on_github/)
[18](https://github.com/octokit/octokit.net/issues/1725)
[19](https://github.com/OfficeDev/teams-toolkit/issues/12767)
[20](https://komodor.com/blog/solving-fatal-not-a-git-repository-error/)
[21](https://octokit.github.io/rest.js/v17/)
[22](https://github.com/supabase/auth-js/issues/742)
[23](https://github.com/orgs/community/discussions/45698)
[24](https://stackoverflow.com/questions/79164353/how-to-create-a-new-branch-with-octokit)
[25](https://forum.gitea.com/t/newbie-question/11121)
[26](https://gist.github.com/mindplace/b4b094157d7a3be6afd2c96370d39fad)
[27](https://octokit.github.io/rest.js/)
[28](https://www.reddit.com/r/node/comments/139uumi/i_need_a_help_to_fix_thistypeerror_cannot_read/)
[29](https://www.theserverside.com/blog/Coffee-Talk-Java-News-Stories-and-Opinions/git-push-new-branch-remote-github-gitlab-upstream-example)
[30](https://stackoverflow.com/questions/9179828/github-api-retrieve-all-commits-for-all-branches-for-a-repo)
[31](https://stackoverflow.com/questions/78410611/octokit-git-add-empty-commit-to-remote-branch)
[32](https://www.youtube.com/watch?v=2AyxS4dvmV0)
[33](https://docs.github.com/rest/repos/contents)
[34](https://github.com/octokit/octokit.net/issues/2190)
[35](https://docs.github.com/en/rest/metrics/statistics)
[36](https://github.com/orgs/community/discussions/162975)
[37](https://github.com/octokit/octokit.rb/issues/1030)
[38](https://docs.github.com/rest/repos/repos)
[39](https://github.com/orgs/community/discussions/102883)
[40](https://github.com/actions/github-script/issues/324)