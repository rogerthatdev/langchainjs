import { Client } from "langsmith";
import {
  BaseRun,
  RunCreate,
  RunUpdate as BaseRunUpdate,
  KVMap,
} from "langsmith/schemas";
import { getEnvironmentVariable, getRuntimeEnvironment } from "../utils/env.js";
import { BaseTracer } from "./base.js";
import { BaseCallbackHandlerInput } from "../callbacks/base.js";

export interface Run extends BaseRun {
  id: string;
  child_runs: this[];
  child_execution_order: number;
  dotted_order?: string;
  trace_id?: string;
}

export interface RunCreate2 extends RunCreate {
  trace_id?: string;
  dotted_order?: string;
}

export interface RunUpdate extends BaseRunUpdate {
  events: BaseRun["events"];
  inputs: KVMap;
  trace_id?: string;
  dotted_order?: string;
}

export interface LangChainTracerFields extends BaseCallbackHandlerInput {
  exampleId?: string;
  projectName?: string;
  client?: Client;
}

export class LangChainTracer
  extends BaseTracer
  implements LangChainTracerFields
{
  name = "langchain_tracer";

  projectName?: string;

  exampleId?: string;

  client: Client;

  constructor(fields: LangChainTracerFields = {}) {
    super(fields);
    const { exampleId, projectName, client } = fields;

    this.projectName =
      projectName ??
      getEnvironmentVariable("LANGCHAIN_PROJECT") ??
      getEnvironmentVariable("LANGCHAIN_SESSION");
    this.exampleId = exampleId;
    this.client = client ?? new Client({});
  }

  private async _convertToCreate(
    run: Run,
    example_id: string | undefined = undefined
  ): Promise<RunCreate> {
    return {
      ...run,
      extra: {
        ...run.extra,
        runtime: await getRuntimeEnvironment(),
      },
      child_runs: undefined,
      session_name: this.projectName,
      reference_example_id: run.parent_run_id ? undefined : example_id,
    };
  }

  protected async persistRun(_run: Run): Promise<void> {}

  async onRunCreate(run: Run): Promise<void> {
    const persistedRun: RunCreate2 = await this._convertToCreate(
      run,
      this.exampleId
    );
    await this.client.createRun(persistedRun);
  }

  async onRunUpdate(run: Run): Promise<void> {
    const runUpdate: RunUpdate = {
      end_time: run.end_time,
      error: run.error,
      outputs: run.outputs,
      events: run.events,
      inputs: run.inputs,
      trace_id: run.trace_id,
      dotted_order: run.dotted_order,
      parent_run_id: run.parent_run_id,
    };
    await this.client.updateRun(run.id, runUpdate);
  }
}
