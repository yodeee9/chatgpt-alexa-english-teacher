# AI英会話教師 Alexa スキル

この Alexa スキルは、ChatGPT を活用して英会話の練習を行うことができる。 
Alexa を「Alexa、Please open ai english teacher」と呼びかけることでスキルを起動し、英会話スクールの先生として Alexa と英会話の練習を行う。

## セットアップ手順

### Slack API トークンの取得

1. [Slack API](https://api.slack.com/) にアクセスし、[Create an app](https://api.slack.com/apps?new_app=1) をクリックして新しいアプリを作成する。

2. 左側のメニューから「OAuth & Permissions」を選択し、「Bot Token Scopes」の下にある「Add an OAuth Scope」をクリックして、`chat:write` スコープを追加する。

3. 「Install App」をクリックして、アプリをワークスペースにインストールする。インストールが完了すると、「Bot User OAuth Token」が表示される。このトークンをメモしておく。

### AWS Lambda のセットアップ
  

1. [npm](https://www.npmjs.com/) を使用して、必要なパッケージをインストールし、`node_modules` ディレクトリを作成する。

``` bash
cd ./src
npm install
```

2. AWS SAMを使用して、AWSリソースをデプロイする
[SAMインストール手順](https://docs.aws.amazon.com/ja_jp/serverless-application-model/latest/developerguide/install-sam-cli.html)
``` bash
sam build -t template.yaml
sam deploy --guided
```

3. 作成した Lambda 関数に、以下の環境変数を設定する。
   - `SLACK_API_TOKEN`: Slack API トークン
   - `SLACK_CHANNEL`: Slack チャンネル ID
   - `OPENAI_API_KEY`: OpenAI API キー

### Alexa スキルのセットアップ

1. Alexa Developer Console でプライマリロケール「英語(US)」で新しいスキルを作成し、スキルのエンドポイントとして Lambda 関数の ARN を設定する。

2. スキルのインタラクションモデルを定義する。インテント、スロット、サンプル発話を含めます。以下のインテントを定義する。
- `StartConversationIntent`: 会話を開始する
- `ConversationIntent`: 会話を続ける
- `AMAZON.StopIntent`: 会話を終了する
- `AMAZON.CancelIntent`: 会話をキャンセルする

 
3. スキルのインタラクションモデルに、以下のサンプル発話を含める。
- StartConversationIntent: "Let's talk"
- ConversationIntent: "{UserReply}"

4. スキルのインタラクションモデルで、UserReply スロットを定義し、AMAZON.Person をスロットタイプとして選択する。これにより、ユーザーが Alexa に返答した内容を取得できる。

5. スキルをビルドし、テストを行う。

これでAlexa に「Alexa、Please open ai english teacher」と呼びかけると、AI 英会話教師として英会話の練習を行うことができる。
また、会話が終了した際に、チャットログが Slack に送信される。


## 使い方
事前にAlexaの言語モードを`English/日本語`モードに設定しておく必要がある。

1. Alexa に「Alexa、Please open ai english teacher」と呼びかけると、スキルが起動する。

2. スキルが起動したら、「Let's talk」と言って、ChatGPT API と連携した英会話スクールの先生として英会話を練習できる。

3. 会話の途中で「Stop」と言うと、会話は終了し、会話ログが事前に指定したSlackのChannelに送信される。
