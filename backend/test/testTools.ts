import { CreationAttributes, UniqueConstraintError, ValidationError } from "sequelize";
import { Context } from "../src/api/trpc";
import { Asset, AssetFileFormat, defaultGamePermissions, defaultSitewidePermissions, getDefaultPermissions, License, Project, RenderingModes, Status, User, UserPermissions, Version } from "../src/shared/Database";
import { fromZodError, isZodErrorLike } from "zod-validation-error";
import { SemVer } from "semver";

// most endpoints don't actually need a fully functional context, so we can just kinda do this
export function createTestContext(userId: number): Context {
    return {
        req: {} as any,
        res: {} as any,
        userId: userId,
        db: {} as any,
    };
}

/**
 * Creates a dummy user with the specified ID and permissions. Does not save to the database, so it can be used for testing permission checks without needing to set up a full user.
 * @param id User ID to use
 * @param permissions Defaults to sitewide permissions
 */
export function createDummyUser(id?: number, permissions?: UserPermissions[], override?: Partial<CreationAttributes<User>>): User
export function createDummyUser(id?: number, permissions?: { sitewide: UserPermissions[]; perGame: Record<string, UserPermissions[]> }, override?: Partial<CreationAttributes<User>>): User
export function createDummyUser(id?: number, permissions?: UserPermissions[] | { sitewide: UserPermissions[]; perGame: Record<string, UserPermissions[]> }, override?: Partial<CreationAttributes<User>>): User {
    if (!permissions) {
        permissions = { sitewide: [...defaultSitewidePermissions, ...defaultGamePermissions], perGame: {} };
    }
    if (Array.isArray(permissions)) {
        permissions = { sitewide: permissions, perGame: {} };
    }
    return new User({
        id: id,
        username: `user${id ? id : Math.floor(Math.random() * 100000)}`,
        discordId: `discord${id ? id : Math.floor(Math.random() * 100000)}`,
        permissions: permissions,
        displayName: `User ${id}`,
        avatarUrl: `https://example.com/`,
        userPlatforms: [],
        bio: "",
        shouldDmAlerts: false,
        ...override,
    });
}

// Generates a random string of the specified length. Used for generating random file hashes and such in tests.
function getRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function createDummyAsset(uploader: number | undefined = 5, id?: number, overrides: Partial<CreationAttributes<Asset>> = {}): Asset {
    if (id) {
        overrides = {
            ...overrides,
            id: id
        }
    }
    return new Asset({
        name: `Asset ${id}`,
        type: AssetFileFormat.Banner_Png,
        description: "This is a test asset",
        license: License.CC0,
        tags: [],
        gameName: "beatsaber",
        fileSize: 1,
        uploaderId: uploader ? uploader : 5,
        fileSafeName: "test_asset.avatar",
        iconNames: ["icon1.png", "icon2.png"],
        fileHash: getRandomString(16),
        ...overrides,
    });
}

export function createDummyProject(gameName:string, id?: number, overrides: Partial<CreationAttributes<Project>> = {}): Project {
    if (id) {
        overrides = {
            ...overrides,
            id: id
        }
    }
    return new Project({
        name: `Project ${id}`,
        nameId: `project-${id}`,
        description: "This is a test project",
        gameName: gameName,
        category: "Other",
        gitUrl: "https://example.com",
        iconFileName: "icon.png",
        lastUpdatedById: 5,
        summary: "This is a test project",
        ...overrides,
    });
}

export function createDummyVersion(projectId: number, author: number | undefined = 5, id?: number, overrides: Partial<CreationAttributes<Version>> = {}): Version {
    if (id) {
        overrides = {
            ...overrides,
            id: id
        }
    }
    return new Version({
        projectId: projectId,
        uploaderId: author ? author : 5,
        contentHashes: [],
        fileSize: 0,
        dependencies: [],
        semver: new SemVer("1.0.0"),
        platform: "universal",
        zipHash: getRandomString(16),
        lastUpdatedById: author ? author : 5,
        status: Status.Private,
        ...overrides,
    });
}

export function handleException(err: unknown): () => never {
    return () => {
        if (err instanceof ValidationError || err instanceof UniqueConstraintError) {
            console.error(`${err.message} ${err.errors.map(e => e.message).join(`, `)}`);
        } else if (isZodErrorLike(err)) {
            //console.error(`Zod error detected:`, JSON.stringify(err, null, 2));
            console.error(fromZodError(err).toString());
        }
        throw err;
    }
}