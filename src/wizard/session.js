import { randomUUID } from 'node:crypto';
import { WizardCancelledError } from './prompts.js';
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
class WizardSessionPrompter {
  constructor(session) {
    this._session = session;
  }
  async intro(title) {
    await this.prompt({
      type: 'note',
      title,
      message: '',
      executor: 'client'
    });
  }
  async outro(message) {
    await this.prompt({
      type: 'note',
      title: 'Done',
      message,
      executor: 'client'
    });
  }
  async note(message, title) {
    await this.prompt({ type: 'note', title, message, executor: 'client' });
  }
  async select(params) {
    const res = await this.prompt({
      type: 'select',
      message: params.message,
      options: params.options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        hint: opt.hint
      })),
      initialValue: params.initialValue,
      executor: 'client'
    });
    return res;
  }
  async multiselect(params) {
    const res = await this.prompt({
      type: 'multiselect',
      message: params.message,
      options: params.options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        hint: opt.hint
      })),
      initialValue: params.initialValues,
      executor: 'client'
    });
    return Array.isArray(res) ? res : [];
  }
  async text(params) {
    const res = await this.prompt({
      type: 'text',
      message: params.message,
      initialValue: params.initialValue,
      placeholder: params.placeholder,
      executor: 'client'
    });
    const value = res === null || res === void 0 ? '' : typeof res === 'string' ? res : typeof res === 'number' || typeof res === 'boolean' || typeof res === 'bigint' ? String(res) : '';
    const error = params.validate?.(value);
    if (error) {
      throw new Error(error);
    }
    return value;
  }
  async confirm(params) {
    const res = await this.prompt({
      type: 'confirm',
      message: params.message,
      initialValue: params.initialValue,
      executor: 'client'
    });
    return Boolean(res);
  }
  // eslint-disable-next-line no-unused-vars
  progress(_label) {
    return {
      // eslint-disable-next-line no-unused-vars
      update: (_message) => {
      },
      // eslint-disable-next-line no-unused-vars
      stop: (_message) => {
      }
    };
  }
  async prompt(step) {
    return await this._session.awaitAnswer({
      ...step,
      id: randomUUID()
    });
  }
}
class WizardSession {
  constructor(runner) {
    this._runner = runner;
    const prompter = new WizardSessionPrompter(this);
    void this.run(prompter);
  }
  _currentStep = null;
  _stepDeferred = null;
  _answerDeferred = /* @__PURE__ */ new Map();
  _status = 'running';
  _error;
  async next() {
    if (this._currentStep) {
      return { done: false, step: this._currentStep, status: this._status };
    }
    if (this._status !== 'running') {
      return { done: true, status: this._status, error: this._error };
    }
    if (!this._stepDeferred) {
      this._stepDeferred = createDeferred();
    }
    const step = await this._stepDeferred.promise;
    if (step) {
      return { done: false, step, status: this._status };
    }
    return { done: true, status: this._status, error: this._error };
  }
  async answer(stepId, value) {
    const deferred = this._answerDeferred.get(stepId);
    if (!deferred) {
      throw new Error('wizard: no pending step');
    }
    this._answerDeferred.delete(stepId);
    this._currentStep = null;
    deferred.resolve(value);
  }
  cancel() {
    if (this._status !== 'running') {
      return;
    }
    this._status = 'cancelled';
    this._error = 'cancelled';
    this._currentStep = null;
    for (const [, deferred] of this._answerDeferred) {
      deferred.reject(new WizardCancelledError());
    }
    this._answerDeferred.clear();
    this._resolveStep(null);
  }
  pushStep(step) {
    this._currentStep = step;
    this._resolveStep(step);
  }
  async run(prompter) {
    try {
      await this._runner(prompter);
      this._status = 'done';
    } catch (err) {
      if (err instanceof WizardCancelledError) {
        this._status = 'cancelled';
        this._error = err.message;
      } else {
        this._status = 'error';
        this._error = String(err);
      }
    } finally {
      this._resolveStep(null);
    }
  }
  async awaitAnswer(step) {
    if (this._status !== 'running') {
      throw new Error('wizard: session not running');
    }
    this.pushStep(step);
    const deferred = createDeferred();
    this._answerDeferred.set(step.id, deferred);
    return await deferred.promise;
  }
  _resolveStep(step) {
    if (!this._stepDeferred) {
      return;
    }
    const deferred = this._stepDeferred;
    this._stepDeferred = null;
    deferred.resolve(step);
  }
  getStatus() {
    return this._status;
  }
  getError() {
    return this._error;
  }
}
export {
  WizardSession
};
