export abstract class BaseMessage {
	abstract type: string;
	abstract data: { [key: string]: any };
	model_dump(): Record<string, unknown> {
		return { type: this.type, ...this.data } as any;
	}
}

interface History {
	role: "user" | "assistant" | "system" | "developer";
	content: string;
	name: string;
}
export class ClientDataMessage extends BaseMessage {
	type = "clientData";
	constructor(
		public data: {
			platform: "PC" | "terminal" | "phone";
			confirm?: boolean;
		}
	) {
		if (!data.confirm) data.confirm = false;
		super();
	}
}

export class LoadProfileMessage extends BaseMessage {
	type = "loadProfile";
	constructor(
		public data: {
			profile: string;
		}
	) {
		super();
	}
}

export class AddChatMessage extends BaseMessage {
	type = "addChat";
	constructor(
		public data: {
			msg: History;
			effort?: "minimal" | "low" | "medium" | "high" | null;
			verbosity?: "low" | "medium" | "high" | null;
		}
	) {
		if (!data.effort) data.effort = null;
		if (!data.verbosity) data.verbosity = null;
		super();
	}
}

export class AddHistoryMessage extends BaseMessage {
	type = "addHistory";
	constructor(public data: {msg: History}) {
		super();
	}
}
