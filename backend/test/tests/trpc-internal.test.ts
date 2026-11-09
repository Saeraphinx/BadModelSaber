import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, test, vi } from "vitest";
import {
    Alert,
    AlertType,
    Asset,
    availableBackendLocaleCodes,
    DatabaseManager,
    Game,
    GameVersion,
    LinkedAssetLinkType,
    Project,
    RequestType,
    Status,
    ThingRequest,
    User,
    UserPermissions,
    Version,
    Keys,
} from "../../src/shared/Database";
import { createDummyAsset, createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools";
import { createCaller } from "../../src/api/routers";
import { SemVer } from "semver";
import { EnvConfig } from "../../src/shared/EnvConfig";

const oauthMocks = vi.hoisted(() => ({
    githubToken: vi.fn(),
    githubUser: vi.fn(),
    discordToken: vi.fn(),
    discordGet: vi.fn(),
    discordRevoke: vi.fn(),
}));

vi.mock("@octokit/oauth-app", async (importOriginal) => {
    const original = await importOriginal<typeof import("@octokit/oauth-app")>();
    return {
        ...original,
        OAuthApp: class {
            getWebFlowAuthorizationUrl({ state }: { state: string }) {
                return { url: `https://github.com/login/oauth/authorize?state=${state}` };
            }
            createToken = oauthMocks.githubToken;
            checkToken = oauthMocks.githubUser;
        },
    };
});

vi.mock("@discordjs/core", async (importOriginal) => {
    const original = await importOriginal<typeof import("@discordjs/core")>();
    return {
        ...original,
        OAuth2API: class {
            generateAuthorizationURL({ state }: { state: string }) {
                return `https://discord.com/oauth2/authorize?state=${state}`;
            }
            tokenExchange = oauthMocks.discordToken;
            revokeToken = oauthMocks.discordRevoke;
        },
    };
});

vi.mock("discord.js", async (importOriginal) => {
    const original = await importOriginal<typeof import("discord.js")>();
    return {
        ...original,
        REST: class {
            setToken() { return this; }
            get = (route: string) => oauthMocks.discordGet(route) ?? Promise.reject(new Error(`Discord request not mocked`));
        },
    };
});

const randomHash = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const createTestCaller = (userId?: number, isApiKey = false) => createCaller({
    userId,
    req: {
        session: {
            userId,
            save: () => undefined,
        },
    } as any,
    res: {
        setHeader: () => undefined,
    } as any,
    isApiKey,
    db: {} as any,
});

const createPngFile = (name: string) => {
    const pngHeader = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return new File([pngHeader], name, { type: "image/png" });
};

describe("trpc-internal", () => {
    let databaseManager: DatabaseManager;
    let schemaName: string;

    let caller = createTestCaller(123456);
    let otherCaller = createTestCaller(123457);
    let anonymousCaller = createTestCaller();

    let testUser: User;
    let otherUser: User;
    let testAsset: Asset;
    let otherAsset: Asset;
    let testProject: Project;
    let testVersion: Version;
    let queueVersion: Version;
    let testGameVersion: GameVersion;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_trpc_int", inject(`postgresUrl`));
        await databaseManager.init();

        try {
            await Game.create({
                name: `beatsaber`,
                displayName: `Beat Saber`,
                default: true,
                webhookConfig: [],
            });

            testGameVersion = await GameVersion.create({
                gameName: `beatsaber`,
                version: `1.37.0`,
                isDefault: true,
            });

            const widePerms = [
                UserPermissions.Users_EditSelf,
                UserPermissions.Administrative_Tasks,
                UserPermissions.Asset_Edit,
                UserPermissions.Asset_EditAll,
                UserPermissions.Asset_Create,
                UserPermissions.Asset_Approval,
                UserPermissions.Asset_InternalTags,
                UserPermissions.Mods_Create,
                UserPermissions.Mods_Edit,
                UserPermissions.Mods_EditAll,
                UserPermissions.Mods_ViewAll,
                UserPermissions.Mods_Approval,
                UserPermissions.Mods_TranslateAll,
                UserPermissions.Requests_ViewAssets,
                UserPermissions.Requests_ViewMods,
                UserPermissions.Requests_ViewUsers,
                UserPermissions.Requests_ViewAll,
                UserPermissions.Requests_ManageAssets,
                UserPermissions.Requests_ManageMods,
                UserPermissions.Requests_ManageUsers,
                UserPermissions.Requests_ManageAll,
                UserPermissions.Game_ViewExtras,
            ];

            testUser = await createDummyUser(123456, widePerms).save();
            otherUser = await createDummyUser(123457).save();

            testAsset = await createDummyAsset(testUser.id, undefined, {
                status: Status.Verified,
                tags: ["Featured" as any],
                name: `Internal Test Asset`,
                fileHash: randomHash(),
            }).save();

            otherAsset = await createDummyAsset(otherUser.id, undefined, {
                status: Status.Verified,
                name: `Other User Asset`,
                fileHash: randomHash(),
            }).save();

            testProject = await createDummyProject(`beatsaber`, undefined, {
                name: `Internal Test Project`,
                nameId: `internal-test-project`,
                status: Status.Public,
                isFeatured: true,
                lastUpdatedById: testUser.id,
            }).save();
            await testProject.$set(`authors`, [testUser.id]);

            testVersion = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.0.0`),
                status: Status.Private,
                lastUpdatedById: testUser.id,
            }).save();
            await testVersion.$set(`supportedGameVersions`, [testGameVersion]);

            queueVersion = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.1.0`),
                status: Status.Queue,
                lastUpdatedById: testUser.id,
            }).save();
            await queueVersion.$set(`supportedGameVersions`, [testGameVersion]);

            fs.mkdirSync(testProject.folderPath, { recursive: true });
        } catch (error) {
            console.error(`Error setting up test data:`, error);
            handleException(error)();
        }
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    describe(`auth`, { concurrent: false }, () => {
        let apiKeysWereEnabled: boolean;

        beforeAll(() => {
            apiKeysWereEnabled = EnvConfig.server.enableApiKeys;
            EnvConfig.server.enableApiKeys = true;
        });

        afterAll(() => {
            EnvConfig.server.enableApiKeys = apiKeysWereEnabled;
        });

        test(`requires login for logout and API key management`, async () => {
            await expect(anonymousCaller.internal.auth.logout()).rejects.toMatchObject({ code: `UNAUTHORIZED` });
            await expect(anonymousCaller.internal.auth.generateApiKey({ name: `anonymous` })).rejects.toMatchObject({ code: `UNAUTHORIZED` });
            await expect(anonymousCaller.internal.auth.listApiKeys()).rejects.toMatchObject({ code: `UNAUTHORIZED` });
            await expect(anonymousCaller.internal.auth.revokeApiKey({ name: `anonymous` })).rejects.toMatchObject({ code: `UNAUTHORIZED` });
        });

        test(`destroys the session on logout and reports session errors`, async () => {
            const destroy = vi.fn((callback: (error?: Error) => void) => callback());
            const logoutCaller = createCaller({
                userId: testUser.id,
                req: { session: { userId: testUser.id, destroy } } as any,
                res: {} as any,
                isApiKey: false,
                db: {} as any,
            });

            await expect(logoutCaller.internal.auth.logout()).resolves.toEqual({ message: `Logged out successfully.` });
            expect(destroy).toHaveBeenCalledOnce();

            destroy.mockImplementation(callback => callback(new Error(`session destroy failed`)));
            await expect(logoutCaller.internal.auth.logout()).rejects.toMatchObject({ code: `INTERNAL_SERVER_ERROR` });
        });

        test(`stores hashed keys, lists only the owner's metadata, and revokes by name`, async () => {
            const created = await caller.internal.auth.generateApiKey({ name: `auth-test-owner` });
            const otherKey = await otherCaller.internal.auth.generateApiKey({ name: `auth-test-other` });
            const secret = created.key.split(`.`)[2];
            const hash = createHash(`sha256`).update(secret).digest(`base64url`);
            const stored = await Keys.findOne({ where: { userId: testUser.id, name: created.name } });

            expect(created.key).toMatch(/^bbmat\.[0-9a-f]+\.[A-Za-z0-9_-]{43,}$/);
            expect(stored?.key).toBe(hash);
            expect(stored?.key).not.toBe(created.key);

            const keys = await caller.internal.auth.listApiKeys();
            expect(keys).toEqual([{
                name: created.name,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
            }]);
            expect(JSON.stringify(keys)).not.toContain(secret);
            expect(JSON.stringify(keys)).not.toContain(hash);

            await expect(caller.internal.auth.revokeApiKey({ name: otherKey.name })).rejects.toMatchObject({ code: `NOT_FOUND` });
            await caller.internal.auth.revokeApiKey({ name: created.name });
            expect(await caller.internal.auth.listApiKeys()).toEqual([]);
            await expect(caller.internal.auth.revokeApiKey({ name: created.name })).rejects.toMatchObject({ code: `NOT_FOUND` });
            await otherCaller.internal.auth.revokeApiKey({ name: otherKey.name });
        });

        test(`accepts a generated API key for authentication`, async () => {
            const created = await caller.internal.auth.generateApiKey({ name: `auth-test-authentication` });
            try {
                expect(await Keys.checkKey(created.key)).toBe(testUser.id);
            } finally {
                await caller.internal.auth.revokeApiKey({ name: created.name });
            }
        });

        test(`revokes a generated API key by its value`, async () => {
            const created = await caller.internal.auth.generateApiKey({ name: `auth-test-revoke-key` });
            try {
                await expect(caller.internal.auth.revokeApiKey({ key: created.key })).resolves.toBeUndefined();
                expect(await Keys.findOne({ where: { userId: testUser.id, name: created.name } })).toBeNull();
            } finally {
                await Keys.destroy({ where: { userId: testUser.id, name: created.name } });
            }
        });

        test(`validates key names and rejects malformed keys`, async () => {
            await expect(caller.internal.auth.generateApiKey({ name: `` })).rejects.toMatchObject({ code: `BAD_REQUEST` });
            await expect(caller.internal.auth.generateApiKey({ name: `x`.repeat(65) })).rejects.toMatchObject({ code: `BAD_REQUEST` });
            await expect(caller.internal.auth.revokeApiKey({ key: `invalid` })).rejects.toMatchObject({ code: `BAD_REQUEST` });
        });

        test(`does not allow API keys to generate more keys`, async () => {
            const apiKeyCaller = createTestCaller(testUser.id, true);
            await expect(apiKeyCaller.internal.auth.generateApiKey({ name: `nested` })).rejects.toMatchObject({ code: `FORBIDDEN` });
        });

        test(`rejects key creation and listing when API keys are disabled`, async () => {
            EnvConfig.server.enableApiKeys = false;
            try {
                await expect(caller.internal.auth.generateApiKey({ name: `disabled` })).rejects.toMatchObject({ code: `FORBIDDEN` });
                await expect(caller.internal.auth.listApiKeys()).rejects.toMatchObject({ code: `FORBIDDEN` });
            } finally {
                EnvConfig.server.enableApiKeys = true;
            }
        });

        test(`protects OAuth login and link routes according to session state`, async () => {
            await expect(caller.internal.auth.discord.login.init({})).rejects.toMatchObject({ code: `FORBIDDEN` });
            await expect(caller.internal.auth.github.login.init({})).rejects.toMatchObject({ code: `FORBIDDEN` });
            await expect(anonymousCaller.internal.auth.discord.link.init()).rejects.toMatchObject({ code: `UNAUTHORIZED` });
            await expect(anonymousCaller.internal.auth.github.link.init()).rejects.toMatchObject({ code: `UNAUTHORIZED` });
        });

        test(`ignores unknown OAuth finalization tokens and incomplete callbacks`, async () => {
            await expect(anonymousCaller.internal.auth.discord.finalize({ token: `unknown`, type: `login` })).resolves.toBeUndefined();
            await expect(anonymousCaller.internal.auth.github.finalize({ token: `unknown`, type: `login` })).resolves.toBeUndefined();
            await expect(anonymousCaller.internal.auth.discord.login.callback({ state: `state` })).resolves.toBeUndefined();
            await expect(anonymousCaller.internal.auth.github.login.callback({ state: `state` })).resolves.toBeUndefined();
            await expect(anonymousCaller.internal.auth.discord.link.callback({ code: `code` })).resolves.toBeUndefined();
            await expect(anonymousCaller.internal.auth.github.link.callback({ code: `code` })).resolves.toBeUndefined();
        });

        describe(`OAuth flows`, { concurrent: false }, () => {
            type Provider = `discord` | `github`;
            const githubId = 987654321;
            const discordId = `987654322`;

            function oauthSession(userId?: number) {
                const session: {
                    userId?: number;
                    oauth?: { state: string; redirect: string; linkUserId?: number };
                    save: (callback?: (error?: Error) => void) => void;
                    regenerate: (callback: (error?: Error) => void) => void;
                } = {
                    userId,
                    save: vi.fn(callback => callback?.()),
                    regenerate: vi.fn(callback => callback()),
                };
                const send = vi.fn();
                const res = { setHeader: vi.fn(), send };
                const makeCaller = (contextUserId?: number) => createCaller({
                    userId: contextUserId,
                    req: { session } as any,
                    res: res as any,
                    isApiKey: false,
                    db: {} as any,
                });
                return { session, send, res, makeCaller };
            }

            async function stageToken(provider: Provider, action: `login` | `link`, state: string, flow: ReturnType<typeof oauthSession>) {
                const auth = flow.makeCaller().internal.auth[provider];
                await auth[action].callback({ code: `test-code`, state });
                const html = flow.send.mock.lastCall?.[0];
                expect(html).toEqual(expect.any(String));
                const token = String(html).match(/\/final\?token=([^"&\s]+)/)?.[1];
                expect(token).toBeTruthy();
                return token!;
            }

            beforeEach(() => {
                oauthMocks.githubToken.mockResolvedValue({ authentication: { token: `github-token` } });
                oauthMocks.githubUser.mockResolvedValue({
                    data: { user: { id: githubId, login: `oauth-github`, name: `OAuth GitHub`, avatar_url: `https://example.com/avatar.png` } },
                });
                oauthMocks.discordToken.mockResolvedValue({ access_token: `discord-token` });
                oauthMocks.discordGet.mockImplementation(async (route: string) => route.includes(`/guilds/`)
                    ? { roles: [`441806759062011905`] }
                    : { id: discordId, username: `oauth-discord`, global_name: `OAuth Discord`, avatar: null });
                oauthMocks.discordRevoke.mockResolvedValue(undefined);
            });

            test.each([`discord`, `github`] as const)(`%s login creates a user and rotates the session`, async (provider) => {
                const flow = oauthSession();
                const auth = flow.makeCaller().internal.auth[provider];
                const redirect = new URL(`/oauth-success`, EnvConfig.server.frontendUrl).toString();
                const { url } = await auth.login.init({ redirect });
                expect(flow.session.oauth?.state).toBeTruthy();
                expect(new URL(url).searchParams.get(`state`)).toBe(flow.session.oauth?.state);
                expect(flow.session.oauth?.redirect).toBe(redirect);
                expect(flow.session.save).toHaveBeenCalled();

                const token = await stageToken(provider, `login`, flow.session.oauth!.state, flow);
                await auth.finalize({ token, type: `login` });
                const user = await User.findByPk(flow.session.userId);
                expect(user).not.toBeNull();
                expect(provider === `discord` ? user?.discordId : user?.githubId)
                    .toBe(provider === `discord` ? discordId : String(githubId));
                expect(flow.session.regenerate).toHaveBeenCalledOnce();
                expect(flow.session.save).toHaveBeenCalled();
                expect(flow.res.setHeader).toHaveBeenCalledWith(`X-Content-Type-Options`, `nosniff`);

                await auth.finalize({ token, type: `login` });
                expect(flow.session.regenerate).toHaveBeenCalledOnce();
            });

            test.each([`discord`, `github`] as const)(`%s login rejects an untrusted redirect`, async (provider) => {
                const flow = oauthSession();
                await flow.makeCaller().internal.auth[provider].login.init({ redirect: `https://attacker.example/path` });
                expect(flow.session.oauth?.redirect).toBe(new URL(EnvConfig.server.frontendUrl).toString());
            });

            test.each([`discord`, `github`] as const)(`%s finalization rejects a mismatched state and consumes the token`, async (provider) => {
                const flow = oauthSession();
                const auth = flow.makeCaller().internal.auth[provider];
                await auth.login.init({});
                const token = await stageToken(provider, `login`, `wrong-state`, flow);
                await auth.finalize({ token, type: `login` });
                expect(flow.session.userId).toBeUndefined();
                flow.session.oauth!.state = `wrong-state`;
                await auth.finalize({ token, type: `login` });
                expect(flow.session.userId).toBeUndefined();
                expect(flow.session.regenerate).not.toHaveBeenCalled();
            });

            test.each([`discord`, `github`] as const)(`%s finalization rejects an expired token`, async (provider) => {
                const flow = oauthSession();
                const auth = flow.makeCaller().internal.auth[provider];
                await auth.login.init({});
                const clock = vi.spyOn(Date, `now`).mockReturnValue(Date.now() - 120_000);
                let token: string;
                try {
                    token = await stageToken(provider, `login`, flow.session.oauth!.state, flow);
                } finally {
                    clock.mockRestore();
                }
                await auth.finalize({ token, type: `login` });
                expect(flow.session.userId).toBeUndefined();
                expect(flow.session.regenerate).not.toHaveBeenCalled();
            });

            test.each([`discord`, `github`] as const)(`%s callback reports provider token exchange failures`, async (provider) => {
                const flow = oauthSession();
                const auth = flow.makeCaller().internal.auth[provider];
                await auth.login.init({});
                (provider === `discord` ? oauthMocks.discordToken : oauthMocks.githubToken)
                    .mockRejectedValueOnce(new Error(`provider unavailable`));
                await expect(auth.login.callback({ code: `test-code`, state: flow.session.oauth!.state }))
                    .rejects.toMatchObject({ code: `INTERNAL_SERVER_ERROR` });
                expect(flow.send).not.toHaveBeenCalled();
            });

            test.each([`discord`, `github`] as const)(`%s link associates the provider with the initiating user`, async (provider) => {
                const linkedDiscordId = `987654323`;
                const linkedGithubId = 987654324;
                oauthMocks.githubUser.mockResolvedValue({
                    data: { user: { id: linkedGithubId, login: `linked-github`, name: `Linked GitHub`, avatar_url: `https://example.com/avatar.png` } },
                });
                oauthMocks.discordGet.mockImplementation(async (route: string) => route.includes(`/guilds/`)
                    ? { roles: [] }
                    : { id: linkedDiscordId, username: `linked-discord`, global_name: `Linked Discord`, avatar: null });
                const target = await createDummyUser(provider === `discord` ? 123460 : 123461, [], {
                    discordId: null,
                    githubId: null,
                }).save();
                const flow = oauthSession(target.id);
                const { url } = await flow.makeCaller(target.id).internal.auth[provider].link.init();
                expect(new URL(url).searchParams.get(`state`)).toBe(flow.session.oauth?.state);
                expect(flow.session.oauth?.linkUserId).toBe(target.id);
                const token = await stageToken(provider, `link`, flow.session.oauth!.state, flow);
                await flow.makeCaller().internal.auth[provider].finalize({ token, type: `link` });
                await target.reload();
                expect(provider === `discord` ? target.discordId : target.githubId)
                    .toBe(provider === `discord` ? linkedDiscordId : String(linkedGithubId));
            });

            test.each([`discord`, `github`] as const)(`%s linking refuses an already linked account`, async (provider) => {
                const target = await createDummyUser(provider === `discord` ? 123462 : 123463, [], {
                    discordId: provider === `discord` ? `existing-discord` : null,
                    githubId: provider === `github` ? `existing-github` : null,
                }).save();
                const flow = oauthSession(target.id);
                await flow.makeCaller(target.id).internal.auth[provider].link.init();
                // Exercise finalization independently of how the init route stores session state.
                flow.session.oauth!.linkUserId = target.id;
                const token = await stageToken(provider, `link`, flow.session.oauth!.state, flow);
                await expect(flow.makeCaller().internal.auth[provider].finalize({ token, type: `link` }))
                    .rejects.toMatchObject({ code: `CONFLICT` });
                await target.reload();
                expect(provider === `discord` ? target.discordId : target.githubId)
                    .toBe(provider === `discord` ? `existing-discord` : `existing-github`);
            });
        });
    });

    describe(`status`, () => {
        test(`status route returns health payload`, async () => {
            const status = await caller.internal.status.status();
            expect(status).toHaveProperty(`message`, `Server is running`);
        });

        test(`adminStatus returns administrative diagnostics`, async () => {
            const status = await caller.internal.status.adminStatus();
            expect(status).toHaveProperty(`dbConnectionOK`, `Connected`);
            expect(status).toHaveProperty(`serverTime`);
            expect(status).toHaveProperty(`version`);
        });

        test(`adminStatus rejects anonymous callers`, async () => {
            await expect(anonymousCaller.internal.status.adminStatus()).rejects.toThrow();
        });
    });

    describe(`alerts`, { concurrent: false }, () => {
        let unreadAlert: Alert;
        let readAlert: Alert;

        beforeAll(async () => {
            unreadAlert = await testUser.createAlert({
                type: AlertType.Generic,
                message: `This is an unread test alert`,
                header: `Unread Alert`,
            }, false);

            readAlert = await testUser.createAlert({
                type: AlertType.Generic,
                message: `This is a read test alert`,
                header: `Read Alert`,
            }, false);
            readAlert.read = true;
            await readAlert.save();
        });

        test(`getAlertCount returns unread count`, async () => {
            const count = await caller.internal.alerts.getAlertCount();
            expect(count).toBeGreaterThan(0);
        });

        test(`getAlerts supports read=true|false|all`, async () => {
            const onlyRead = await caller.internal.alerts.getAlerts({ read: `true` });
            const onlyUnread = await caller.internal.alerts.getAlerts({ read: `false` });
            const all = await caller.internal.alerts.getAlerts({ read: `all` });

            expect(onlyRead.every(a => a.read)).toBe(true);
            expect(onlyUnread.every(a => !a.read)).toBe(true);
            expect(all.length).toBeGreaterThanOrEqual(onlyRead.length);
            expect(all.length).toBeGreaterThanOrEqual(onlyUnread.length);
        });

        test(`markAlertRead marks alert as read`, async () => {
            const response = await caller.internal.alerts.markAlertRead({ id: unreadAlert.id });
            expect(response.read).toBe(true);
            await unreadAlert.reload();
            expect(unreadAlert.read).toBe(true);
        });

        test(`markAlertRead throws for another user's alert`, async () => {
            const otherAlert = await otherUser.createAlert({
                type: AlertType.Generic,
                message: `This is another user's alert`,
                header: `Other User Alert`,
            }, false);
            await expect(caller.internal.alerts.markAlertRead({ id: otherAlert.id })).rejects.toThrowError();
        });

        test(`deleteAlert deletes own alert and rejects others`, async () => {
            await caller.internal.alerts.deleteAlert({ id: readAlert.id });
            const deletedAlert = await Alert.findByPk(readAlert.id);
            expect(deletedAlert).toBeNull();

            const otherAlert = await otherUser.createAlert({
                type: AlertType.Generic,
                message: `This is another user's alert`,
                header: `Other User Alert`,
            }, false);
            await expect(caller.internal.alerts.deleteAlert({ id: otherAlert.id })).rejects.toThrowError();
        });
    });

    describe(`requests`, () => {
        let userReport: ThingRequest;
        let directCreditRequest: ThingRequest;

        beforeAll(async () => {
            userReport = await ThingRequest.create({
                refrencedId: otherUser.id,
                requesterId: testUser.id,
                refrencedGameName: null,
                requestType: RequestType.User_Report,
                requestResponseBy: testUser.id,
                objectToAdd: null,
                messages: [{ userId: testUser.id, message: `report reason`, timestamp: new Date().toISOString() }],
            });

            directCreditRequest = await ThingRequest.create({
                refrencedId: otherAsset.id,
                requesterId: otherUser.id,
                refrencedGameName: otherAsset.gameName,
                requestType: RequestType.Asset_Credit,
                requestResponseBy: testUser.id,
                objectToAdd: otherUser.id,
                messages: [{ userId: otherUser.id, message: `please credit me`, timestamp: new Date().toISOString() }],
            });
        });

        test(`getMyRequests returns incoming and outgoing`, async () => {
            const response = await caller.internal.requests.getMyRequests({ includeActioned: true });
            expect(Array.isArray(response.incoming)).toBe(true);
            expect(Array.isArray(response.outgoing)).toBe(true);
        });

        test(`getAllRequests returns visible requests for reviewer`, async () => {
            const response = await caller.internal.requests.getAllRequests({
                includeActioned: true,
                includeSpecificResponseBy: true,
            });
            expect(response.length).toBeGreaterThan(0);
        });

        test(`requestCounts returns pending counters`, async () => {
            const response = await caller.internal.requests.requestCounts();
            expect(response).toHaveProperty(`incoming`);
            expect(response).toHaveProperty(`outgoing`);
        });

        test(`getRequest returns a visible request`, async () => {
            const response = await caller.internal.requests.getRequest({ id: userReport.id });
            expect(response.id).toBe(userReport.id);
        });

        test(`addMessage appends message to request`, async () => {
            await caller.internal.requests.addMessage({ id: userReport.id, message: `follow-up` });
            await userReport.reload();
            expect(userReport.messages.some(m => m.message === `follow-up`)).toBe(true);
        });

        test(`handleRequest accepts/declines handled requests`, async () => {
            const accepted = await caller.internal.requests.handleRequest({
                id: directCreditRequest.id,
                action: `accept`,
                actuallyHandle: true,
            });
            expect(accepted.message).toContain(`accepted`);

            const declineCandidate = await ThingRequest.create({
                refrencedId: otherAsset.id,
                requesterId: otherUser.id,
                refrencedGameName: otherAsset.gameName,
                requestType: RequestType.Asset_Credit,
                requestResponseBy: testUser.id,
                objectToAdd: otherUser.id,
                messages: [{ userId: otherUser.id, message: `please decline`, timestamp: new Date().toISOString() }],
            });

            const declined = await caller.internal.requests.handleRequest({
                id: declineCandidate.id,
                action: `decline`,
            });
            expect(declined.message).toContain(`declined`);
        });

        test(`reportThing creates a report request`, async () => {
            const response = await caller.internal.requests.reportThing({
                thingId: otherAsset.id,
                thingType: `asset`,
                reason: `inappropriate upload`,
            });
            expect(response.requestType).toBe(RequestType.Asset_Report);
            expect(response.refrencedThingId).toBe(otherAsset.id);
        });

        test(`getAllRequests rejects users without request-view permissions`, async () => {
            await expect(otherCaller.internal.requests.getAllRequests({ includeActioned: true })).rejects.toThrow();
        });
    });

    describe(`getThings`, () => {
        test(`getProject and getBulkProjects return visible projects`, async () => {
            const single = await caller.internal.getThings.getProject({ projectId: testProject.id });
            expect(single.id).toBe(testProject.id);

            const bulk = await caller.internal.getThings.getBulkProjects({ projectIds: [testProject.id] });
            expect(bulk.some(project => project.id === testProject.id)).toBe(true);
        });

        test(`searchProjects and searchProjectsByNameId resolve public project identifiers`, async () => {
            const byName = await caller.internal.getThings.searchProjects({ query: `Internal Test`, gameName: `beatsaber` });
            expect(byName.some(project => project.id === testProject.id)).toBe(true);

            const byNameId = await caller.internal.getThings.searchProjectsByNameId({
                nameIds: [testProject.nameId],
                gameName: `beatsaber`,
            });
            expect(byNameId.some(project => project.id === testProject.id)).toBe(true);
        });

        test(`approvalQueueVersions returns queued/testing versions`, async () => {
            const response = await caller.internal.getThings.approvalQueueVersions({ gameName: `beatsaber` });
            expect(response.some(row => row.version.id === queueVersion.id)).toBe(true);
        });

        test(`generateDiff returns bad request when decompiled files do not exist`, async () => {
            const secondVersion = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.2.0`),
                status: Status.Private,
                lastUpdatedById: testUser.id,
            }).save();
            await secondVersion.$set(`supportedGameVersions`, [testGameVersion]);

            await expect(caller.internal.getThings.generateDiff({
                versionId1: testVersion.id,
                versionId2: secondVersion.id,
            })).rejects.toThrow();
        });

        test(`getFrontPageIcons returns featured/public content`, async () => {
            const response = await caller.internal.getThings.getFrontPageIcons();
            expect(response.length).toBeGreaterThan(0);
        });
    });

    describe(`updateThings`, () => {
        test(`asset.updateAsset updates editable fields`, async () => {
            await expect(caller.internal.updateThings.asset.updateAsset({
                id: testAsset.id,
                data: {
                    name: `Updated Internal Asset`,
                },
            })).resolves.not.toThrow();
        });

        test(`asset.submitAssetForApproval queues private assets`, async () => {
            const privateAsset = await createDummyAsset(testUser.id, undefined, {
                status: Status.Private,
                name: `Queue Candidate Asset`,
                fileHash: randomHash(),
            }).save();

            const response = await caller.internal.updateThings.asset.submitAssetForApproval({ id: privateAsset.id });
            expect(response.status).not.toBe(Status.Private);
        });

        test(`asset.addAssetLink and addAssetCollaborator create requests`, async () => {
            const linkResponse = await caller.internal.updateThings.asset.addAssetLink({
                id: testAsset.id,
                linkToId: otherAsset.id,
                type: LinkedAssetLinkType.Alternate,
            });
            expect([`Request created successfully`, `Asset linked successfully`]).toContain(linkResponse.message);

            const collabResponse = await caller.internal.updateThings.asset.addAssetCollaborator({
                id: testAsset.id,
                userId: otherUser.id,
            });
            expect(collabResponse.requestType).toBe(RequestType.Asset_Credit);
        });

        test(`project.updateProject updates mutable project fields`, async () => {
            const response = await caller.internal.updateThings.project.updateProject({
                id: testProject.id,
                data: {
                    summary: `Updated summary`,
                },
            });
            expect(response.summary).toBe(`Updated summary`);
        });

        test(`project.updateProjectIcon writes a new icon`, async () => {
            const form = new FormData();
            form.set(`projectId`, testProject.id.toString());
            form.set(`icon`, createPngFile(`project-icon.png`));

            const response = await caller.internal.updateThings.project.updateProjectIcon(form as any);
            expect(response.id).toBe(testProject.id);
            expect(response.iconFileUrl).toContain(`/`);
        });

        test(`version.updateVersion updates semver/dependencies/game versions`, async () => {
            const response = await caller.internal.updateThings.version.updateVersion({
                id: testVersion.id,
                data: {
                    semver: `2.0.0`,
                    dependencies: [],
                    supportedGameVersionIds: [testGameVersion.id],
                },
            });
            expect(response.semver).toBe(`2.0.0`);
        });

        test(`version.submitForApproval and removeFromQueue transition status`, async () => {
            const approvalCandidate = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`3.0.0`),
                status: Status.Private,
                lastUpdatedById: testUser.id,
            }).save();
            await approvalCandidate.$set(`supportedGameVersions`, [testGameVersion]);

            const queued = await caller.internal.updateThings.version.submitForApproval({ id: approvalCandidate.id });
            expect(queued.status).toBe(Status.Queue);

            const backToPrivate = await caller.internal.updateThings.version.removeFromQueue({ id: approvalCandidate.id });
            expect(backToPrivate.status).toBe(Status.Private);
        });

        test(`user.updateUser and toggleSecretFeatures update user profile/permissions`, async () => {
            const updated = await caller.internal.updateThings.user.updateUser({
                id: testUser.id,
                displayName: `Updated Display Name`,
                bio: `Updated Bio`,
            });
            expect(updated.displayName).toBe(`Updated Display Name`);

            await caller.internal.updateThings.user.toggleSecretFeatures({ enabled: true });
            await testUser.reload();
            expect(testUser.permissions.sitewide.includes(UserPermissions.Secret_Features)).toBe(true);

            await caller.internal.updateThings.user.toggleSecretFeatures({ enabled: false });
            await testUser.reload();
            expect(testUser.permissions.sitewide.includes(UserPermissions.Secret_Features)).toBe(false);
        });
    });

    describe.skipIf(availableBackendLocaleCodes.length <= 1)(`translations`, () => {

        test(`createOrUpdateTranslationForProject creates and then updates entries`, async () => {
            const created = await caller.internal.translation.createOrUpdateTranslationForProject({
                id: testProject.id,
                language: `ja`,
                contentType: `summary`,
                translatedString: `ja-summary`,
            });
            expect(created.language).toBe(`ja`);

            const updated = await caller.internal.translation.createOrUpdateTranslationForProject({
                id: testProject.id,
                language: `ja`,
                contentType: `summary`,
                translatedString: `ja-summary-updated`,
            });
            expect(updated.translatedString).toBe(`ja-summary-updated`);
        });

        test(`getTranslationsForProject returns project translation rows`, async () => {
            const rows = await caller.internal.translation.getTranslationsForProject({ id: testProject.id });
            expect(rows.length).toBeGreaterThan(0);
            expect(rows.some(row => row.parentId === testProject.id)).toBe(true);
        });

        test(`translations show up when called via getMods with language param`, async () => {
            const updated = await caller.internal.translation.createOrUpdateTranslationForProject({
                id: testProject.id,
                language: `ja`,
                contentType: `description`,
                translatedString: `ja-description`,
            });
            const projectWithTranslation = await caller.v3.mods.getProjectAndVersions({ projectId: testProject.id, language: `ja` });
            expect(projectWithTranslation.project.translation?.description).toBe(`ja-description`);
        });
    });
});
