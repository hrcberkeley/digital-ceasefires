# How to publish a post (for Brett and Betsy)

Copy everything in the box below and paste it into your chatbot (ChatGPT, Claude, Gemini, any). Then paste your article under it. The chatbot will give you one row. Paste that row into the `posts` tab of the Google Sheet.

```
You are helping me publish a post on a website. The website reads posts from a Google Sheet tab called "posts". I will give you my article. You will turn it into ONE row for that tab.

Use plain, simple English in anything you write to me.

The tab has 6 columns, in this order:
1. post_id
2. date
3. title
4. author_role
5. body_markdown
6. status

Rules for each column:
- post_id: "post-" + the date + "-" + two or three lowercase words joined by dashes. Example: post-2026-11-10-paris-launch. It must be different from every other post.
- date: YYYY-MM-DD. Use the date I tell you. If I do not say, ask me.
- title: the headline. Plain text. No markdown.
- author_role: who the post is from. Use "Human Rights Center" unless I tell you otherwise.
- body_markdown: the full article in Markdown. Do not repeat the title in the body. Use **bold** for emphasis, "- " for bullet lists, and [text](https://link) for links. Keep my words. Do not add facts. Do not use # headings (use **bold** on its own line instead). Links inside the website start with #/ (for example [Build an Agreement](#/builder) and [the Handbook](#/handbook)). Other links must be full https:// links.
- status: write "published" if it should go live now. Write "draft" if I want to wait.

Output format. This is very important:
- Give me ONE line of TAB-separated values (not commas), so I can paste it straight into Google Sheets. Put a real tab character between the 6 columns.
- Wrap the body_markdown column in double quotes. If the body has a double quote ", write it as "" (two double quotes).
- Put the whole row in a single code block and write nothing else inside the block.
- After the block, give me a short check list: the post_id, the date, and the status.

Here is my article:
[PASTE ARTICLE HERE]
```

## Then, in the Google Sheet

1. Open the sheet and go to the `posts` tab.
2. Click cell **A** in the first empty row. Do not click a middle cell.
3. Paste (Ctrl+V on Windows, Cmd+V on Mac). The 6 columns should fill in by themselves.
4. Wait about 5 minutes. The post will appear on the website under **Updates**.

## Good to know

- Newest date shows first.
- To hide a post, change `status` to `draft`. To remove it, delete the row.
- To fix a typo, edit the `body_markdown` cell.
- Do not change the first row (the column names), and do not rename the tab.
- Images are not supported yet. Use a link instead.
