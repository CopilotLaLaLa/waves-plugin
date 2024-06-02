import plugin from '../../../lib/plugins/plugin.js'
import Waves from "../components/Code.js";
import Config from "../components/Config.js";
import Render from '../model/render.js'

export class UserInfo extends plugin {
    constructor() {
        super({
            name: "鸣潮-用户信息",
            event: "message",
            priority: 1009,
            rule: [
                {
                    reg: "^(～|~|鸣潮)(信息|卡片).*$",
                    fnc: "userInfo"
                }
            ]
        })
    }

    async userInfo(e) {
        let accountList = JSON.parse(await redis.get(`Yunzai:waves:users:${e.user_id}`)) || await Config.getUserConfig(e.user_id);
        const waves = new Waves();

        const match = e.msg.match(/\d{9}$/);

        if (!accountList.length) {
            if (match) {
                const publicCookie = await waves.getPublicCookie();
                if (!publicCookie) {
                    return await e.reply('当前没有可用的公共Cookie，请使用[~登录]进行绑定');
                } else {
                    accountList.push(publicCookie);
                }
            } else {
                return await e.reply('当前没有绑定任何账号，请使用[~登录]进行绑定');
            }
        }

        let data = [];
        let deleteroleId = [];

        await Promise.all(accountList.map(async (account) => {
            const usability = await waves.isAvailable(account.token);

            if (!usability) {
                data.push({ message: `账号 ${account.roleId} 的Token已失效\n请重新绑定Token` });
                deleteroleId.push(account.roleId);
                return;
            }

            if (match) {
                account.roleId = match[0];
            }

            const [baseData, roleData] = await Promise.all([
                waves.getBaseData(account.serverId, account.roleId, account.token),
                waves.getRoleData(account.serverId, account.roleId, account.token)
            ]);

            if (!baseData.status || !roleData.status) {
                data.push({ message: baseData.msg || roleData.msg });
            } else {
                const imageCard = await Render.userInfo(baseData.data, roleData.data)
                data.push({ message: imageCard });
            }
        }));

        if (deleteroleId.length) {
            let newAccountList = accountList.filter(account => !deleteroleId.includes(account.roleId));
            Config.setUserConfig(e.user_id, newAccountList);
        }

        if (data.length === 1) {
            await e.reply(data[0].message);
            return true;
        }

        await e.reply(Bot.makeForwardMsg([{ message: `用户 ${e.user_id}` }, ...data]));
        return true;
    }
}