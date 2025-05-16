///<reference types="@digitalpersona/websdk" />

namespace IWA {

    export class Event {
        type: string;
        constructor(type: string) {
            this.type = type;
        }
    }

    export class CommunicationEvent extends Event {
        constructor(type: string) {
            super(type);
        }
    }

    export class CommunicationFailed extends CommunicationEvent {
        constructor() {
            super("CommunicationFailed");
        }
    }

    export interface Handler<E> {
        (event: E): any;
    }

    export interface MultiCastEventSoure {
        on(event: string, handler: Handler<Event>): MultiCastEventSoure;
        off(event?: string, handler?: Handler<Event>): MultiCastEventSoure;
    }

    export interface CommunicationEventSource {
        onCommunicationFailed?: Handler<CommunicationFailed>;
    }


    export interface EventSource extends CommunicationEventSource, MultiCastEventSoure {
        on(event: string, handler: Handler<Event>): EventSource;
        on(event: "CommunicationFailed", handler: Handler<CommunicationFailed>): EventSource;
        off(event?: string, handler?: Handler<Event>): EventSource;
    }

    // @internal
    enum Method {
        Init = 1,
        Continue = 2,
        Term = 3,
        Authenticate = 4
    }

    // @internal
    enum MessageType {
        Response = 0,
        Notification = 1
    }

    // @internal
    interface Response {
        Method: Method;
        Result: number;
        Data?: string;
    }

    // @internal
    interface Message {
        Type: MessageType;
        Data: string;
    }

    export interface IWAData {
        Handle: number;     // Authentication handle
        Data: string;       // Authentication data
    }

    // @internal
    class Command {
        Method: Method;
        Parameters?: string;
        constructor(method: Method, parameters?: string) {
            this.Method = method;
            if (parameters)
                this.Parameters = parameters;
        }
    }

    // @internal
    class Request {
        command: Command;
        resolve: Function;
        reject: Function;
        sent: boolean;
        timeoutId: number;
        constructor(command: Command, resolve: Function, reject: Function) {
            this.command = command;
            this.resolve = resolve;
            this.reject = reject;
            this.sent = false;
            this.timeoutId = 0;
        }
    }

    // @internal
    class InitTimeoutResponse implements Response {
        Method: Method;
        Result: number;
        Data?: string;
        constructor() {
            this.Method = Method.Init;
            this.Result = -2147023436;
        }
    }

    // @internal
    interface AuthenticationError
    {
        status: 0,
    }
    // @internal
    interface ContinueAuthentication
    {
        status: 1,
        authData: string,
    }
    // @internal
    interface AuthenticationResult
    {
        status: 2,
        jwt: string
    }
    // @internal
    interface ServerContinue {
        ContinueAuthenticationResult: ContinueAuthentication | AuthenticationResult | AuthenticationError
    }


    /**
     * Integrated Windows Authentication API.
     * An instance of this class allows internet browsers to authenticate in DigitalPersona servers
     * using Integrated Windows Authentication.
     * The IWA API uses DigitalPersona WebSDK to communicate with Windwows operating system and extract
     * Windows account data for authentication.
     */
    export class WebApi implements EventSource {

        private webChannel: WebSdk.WebChannelClient;
        private requests: Request[] = [];
        private handlers: { [key: string]: Handler<Event>[] } = {};

        /**
         * Constructs a new IWA API object.
         * @param options - options for the `WebSdk` channel.
         */
        constructor(options?: WebSdk.WebChannelOptionsData) {
            this.webChannel = new WebSdk.WebChannelClient("wia", options);
            this.webChannel.onConnectionSucceed =  this.onConnectionSucceed.bind(this);
            this.webChannel.onConnectionFailed = this.onConnectionFailed.bind(this);
            this.webChannel.onDataReceivedTxt = this.onDataReceivedTxt.bind(this);
        }

        /** Initiates an authentication flow on the client side.
         *
         * Used internally in the {@link WebApi.authenticate} method.
         */
        init(): Promise<IWAData> {
            var _instance = this;
            return new Promise<IWAData>(function (resolve, reject) {
                var command = new Command(Method.Init);
                var request = new Request(command, resolve, reject);
                _instance.requests.push(request);
                if (_instance.webChannel.isConnected())
                    _instance.processQueue();
                else
                    _instance.webChannel.connect();
            });
        }

        /** Performs a second step in the authentication flow on the client side
         * when requested by the server.
         *
         * Used internally in the {@link WebApi.authenticate} method.
         */
        continue(handle: number, data: string): Promise<IWAData> {
            var _instance = this;
            return new Promise<IWAData>(function (resolve, reject) {
                var continueParams = { Handle: handle, Data: data};
                var command = new Command(Method.Continue, JSON.stringify(continueParams));
                var request = new Request(command, resolve, reject);
                _instance.requests.push(request);
                if (_instance.webChannel.isConnected())
                    _instance.processQueue();
                else
                    _instance.webChannel.connect();
            });
        }

        /** Closes the cient's authentication handle,
         * terminating the authentication flow on the client side.
         *
         * Used internally in the {@link WebApi.authenticate} method.
         */
        term(handle: number): Promise<void> {
            var _instance = this;
            return new Promise<void>(function (resolve, reject) {
                var termParams = { Handle: handle };
                var command = new Command(Method.Term, JSON.stringify(termParams));
                var request = new Request(command, resolve, reject);
                _instance.requests.push(request);
                if (_instance.webChannel.isConnected())
                    _instance.processQueue();
                else
                    _instance.webChannel.connect();
            });
        }

        /**
         * Authenticates the user using the URL of a DigitalPersona WebAuth endpoind.
         * This method performs all the steps of the authentication flow:
         * 1. initiates an authentication on the WebAuth service and
         *    receives a server's authentication handle, then
         *    calls {@link WebApi.init} to initiate the native client and
         *    obtain a client's authentication handle and data.
         * 2. sends the client authentication data to the WebAuth service for validation,
         *    then receives either a JWT token, or a request to continue authentication,
         *    or rejection. If JWT token is obtained, the method returns the token.
         *    If a rejection is received, the method returns an error.
         *    If a request to continue authentication is received, the next step is performed.
         * 3. calls {@link WebApi.continue} to continue the authentication flow, then
         *    sends the returned client data to the WebAuth service, and repeats this until
         *    either a JWT token is received, or a rejection is received (max 2 times).
         *    If JWT token is obtained, the method returns the token.
         *    If a rejection is received, the method returns an error.
         *
         * Whether a JWT token returned or an error is thrown, the authentication flow
         * is terminated by calling {@link WebApi.term} and notifying the WebAuth service.
         *
         * @param url - The WebAuth service endpoint URL.
         * @returns A promise that resolves with the authentication token.
         */
        authenticate(url: string): Promise<string> {
            var _instance = this;
            var _authHandle = 0;
            var _clientHandle = 0;
            var _url = url;
            return new Promise<string>(function (resolve, reject) {
                return _instance.createAuthentication(_url)
                    .then(data => {
                        var _result = JSON.parse(data);
                        _authHandle = _result.CreateUserAuthenticationResult;
                        return _instance.init();
                    })
                    .then(data => {
                        _clientHandle = data.Handle;
                        return _instance.continueAuthentication(_url, _authHandle, data.Data);
                    })
                    .then(data => {
                        var _result = JSON.parse(data) as ServerContinue;
                        if (_result.ContinueAuthenticationResult.status == 0)
                            reject(new Error("Authentication failed..."));
                        else if (_result.ContinueAuthenticationResult.status == 1) // continue
                        {
                            return _instance.continue(_clientHandle, _result.ContinueAuthenticationResult.authData);
                        }
                        else resolve(_result.ContinueAuthenticationResult.jwt);
                    })
                    .then(data => {
                        return _instance.continueAuthentication(_url, _authHandle, data?.Data!);
                    })
                    .then(data => {
                        var _result = JSON.parse(data) as ServerContinue;
                        if (_result.ContinueAuthenticationResult.status == 0)
                            reject(new Error("Authentication failed..."));
                        else if (_result.ContinueAuthenticationResult.status == 1) // continue
                        {
                            return _instance.continue(_clientHandle, _result.ContinueAuthenticationResult.authData);
                        }
                        else { // done
                            _instance.term(_clientHandle)
                                .catch(error => { }); // do nothing here
                            _instance.destroyAuthentication(_url, _authHandle)
                                .catch(error => { }); // do nothing here
                            resolve(_result.ContinueAuthenticationResult.jwt);
                        }
                    })
                    .then(data => {
                        return _instance.continueAuthentication(_url, _authHandle, data?.Data!);
                    })
                    .then(data => {
                        var _result = JSON.parse(data);
                        if (_result.ContinueAuthenticationResult.status == 0)
                            reject(new Error("Authentication failed..."));
                        else if (_result.ContinueAuthenticationResult.status == 1) // continue
                        {
                            return _instance.continue(_clientHandle, _result.ContinueAuthenticationResult.authData);
                        }
                        else { // done
                            _instance.term(_clientHandle)
                                .catch(error => { }); // do nothing here
                            _instance.destroyAuthentication(_url, _authHandle)
                                .catch(error => { }); // do nothing here
                            resolve(_result.ContinueAuthenticationResult.jwt);
                        }
                    })
                    .catch(error => {
                        _instance.term(_clientHandle)
                            .catch(error => { }); // do nothing here
                        _instance.destroyAuthentication(_url, _authHandle)
                            .catch(error => { }); // do nothing here
                        reject(new Error(error.message));
                    });
            });
        }

        private onConnectionSucceed(): void {
            this.processQueue();
        }

        private onConnectionFailed(): void {
            for (var i = 0; i < this.requests.length; i++) {
                this.requests[i].reject(new Error("Communication failure."));
            }
            this.requests = [];
            this.emit(new CommunicationFailed());
        }

        private onDataReceivedTxt(data: string): void {
            var message = <Message>JSON.parse(data);
            if (message.Type === MessageType.Response) {
                var response = <Response>JSON.parse(message.Data);
                this.processResponse(response);
            }
            else if (message.Type === MessageType.Notification) {
                // notifications are not supported
            }
        }

        /**
         * Processes the response queue.
         */
        private processQueue(): void {
            for (var i = 0; i < this.requests.length; i++) {
                if (this.requests[i].sent)
                    continue;
                this.webChannel.sendDataTxt(JSON.stringify(this.requests[i].command));
                this.requests[i].sent = true;
                if (this.requests[i].command.Method === Method.Init) {
                    var _instance = this;
                    this.requests[i].timeoutId = setTimeout(function () {
                        var timeoutResponse = new InitTimeoutResponse();
                        _instance.processResponse(timeoutResponse);
                    }, 3000);
                }
            }
        }

        /**
         * Processes a response from the server.
         * @param response - a response object to process.
         */
        private processResponse(response: Response): void {
            var request: Request | undefined;
            for (var i = 0; i < this.requests.length; i++) {
                if (!this.requests[i].sent)
                    continue;
                if (this.requests[i].command.Method === response.Method) {
                    request = this.requests[i];
                    if (request.timeoutId > 0)
                        clearTimeout(request.timeoutId);
                    this.requests.splice(i, 1);
                    break;
                }
            }
            if (request) {
                if (response.Method === Method.Init) {
                    if (response.Result < 0 || response.Result > 2147483647)
                        request.reject(new Error("Init: " + (response.Result >>> 0).toString(16)));
                    else {
                        var data = <IWAData>JSON.parse(response.Data!);
                        request.resolve(data);
                    }
                }
                else if (response.Method === Method.Continue) {
                    if (response.Result < 0 || response.Result > 2147483647)
                        request.reject(new Error("Continue: " + (response.Result >>> 0).toString(16)));
                    else {
                        var data = <IWAData>JSON.parse(response.Data!);
                        request.resolve(data);
                    }
                }
                else if (response.Method === Method.Term) {
                    if (response.Result < 0 || response.Result > 2147483647)
                        request.reject(new Error("Term: " + (response.Result >>> 0).toString(16)));
                    else
                        request.resolve();
                }
            }
        }

        /** A uni-cast event handler for the {@link CommunicationFailed} event. */
        onCommunicationFailed?: Handler<CommunicationFailed>;

        /**
         * Adds an event handler for the event.
         * This is a multicast subscription, i.e. many handlers can be registered at once.
         *
         * @param event - a name of the event to subscribe, e.g. "CommunicationFailed"
         * @param handler - an event handler.
         * @returns the same event source object.
         *
         * @example
         * ```
         * const onCommunicationFailed = (event) => { ... }
         *
         * const api = new IWA.WebSdk();
         *
         * // subscribe to the event
         * api.on("CommunicationFailed", onCommunicationFailed);
         *
         * // unsubscribe from the event
         * api.off("CommunicationFailed", this.onCommunicationFailed);
         *
         * // alternatively, unsubscribe from all events at once
         * api.off();
         * ```
         */
        on(event: string, handler: Handler<Event>): WebApi {
            if (!this.handlers[event])
                this.handlers[event] = [];
            this.handlers[event].push(handler);
            return this;
        }

        /** Deletes an event handler for the event.
         * @param event - a name of the event to subscribe; if empty, all events are unsubscribed.
         * @param handler - an event handler added with the {@link WebApi.on} method. If empty, all handlers for the event are unsubscribed.
         * @returns the same event source object.
         */
        off(event?: string, handler?: Handler<Event>): WebApi {
            if (event) {
                var hh: Handler<Event>[] = this.handlers[event];
                if (hh) {
                    if (handler)
                        this.handlers[event] = hh.filter(h => h !== handler);
                    else
                        delete this.handlers[event];
                }
            }
            else
                this.handlers = {};
            return this;
        }

        /**
         * Emits an event to all handlers registered for the event,
         * including both single- and multicast ones.
         *
         * @param event - an event to emit.
         */
        protected emit(event: Event): void {
            if (!event) return;

            var eventName: string = event.type;
            var unicast: Handler<Event> = (this as any)["on" + eventName];
            if (unicast)
                this.invoke(unicast, event);

            var multicast: Handler<Event>[] = this.handlers[eventName];
            if (multicast)
                multicast.forEach(h => this.invoke(h, event));
        }

        /**
         * Invokes an event handler in a exception-safe manner.
         * @param handler - an event handler to invoke.
         * @param event - an event to pass to the handler.
         */
        private invoke(handler: Handler<Event>, event: Event) {
            try {
                handler(event);
            } catch (e) {
                console.error(e);
            }
        }

        /**
         * Sends a request to the DigitalPersona WebAuth server.
         *
         * @param url - a DigitalPersona WebAuth endpoint
         * @param func - a function name to call on the server
         * @param data - a JSON string with parameters for the function
         * @param method - HTTP method to use, e.g. "POST", "GET", etc.
         * @returns a promise to return a response from the server.
         */
        private submitData(url: string, func: string, data: string, method: string) {
            return new Promise<string>(function (resolve, reject) {
                url = url + func;
                var postData = data;
                var async = true;
                var request = new XMLHttpRequest();
                request.onload = function () {
                    var status = request.status; // HTTP response status, e.g., 200 for "200 OK"
                    var data = request.responseText; // Returned data, e.g., an HTML document.
                    if (status == 200)
                        resolve(data);
                    else reject(new Error(data));
                }
                request.open(method, url, async);
                request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                request.send(postData);
            });
        }

        /**
         * Initiates an authentication flow on the DigitalPersona WebAuth server.
         *
         * The server is expected to reply returning an authentication hande and
         * either a cached JWT token, or a challenge, or outright reject the request.
         *
         * @param url - a DigitalPersona WebAuth endpoint
         * @returns a promise to return an authentication token encoded in a JSON string.
         */
        private createAuthentication(url: string): Promise<string> {
            return this.submitData(url, "CreateUserAuthentication", "{\"user\":null,\"credentialId\":\"AE922666-9667-49BC-97DA-1EB0E1EF73D2\"}", "POST");
        }

        /**
         * Requests the DigitalPersona WebAuth service to perform a second step using the client's data.
         *
         * The server is expected to reply returning an authentication hande and
         * either a cached JWT token, or a challenge, or outright reject the request.
         *
         * @param url - a DigitalPersona WebAuth endpoint
         * @param handle - a server authentication handle returned by the {@link WebApi.createAuthentication}
         * @param data - client's data returned in the {@link IWAData.Data}
         * @returns a promise to return {@link ServerContinue} object encoded in JSON string,
         *          which may contain either a rejection, or a continuation request, or a JWT token.
         */
        private continueAuthentication(url: string, handle: number, data: string): Promise<string> {
            var continueAuthentication = {
                authId: handle,
                authData: data
            }
            var _request = JSON.stringify(continueAuthentication);
            return this.submitData(url, "ContinueAuthentication", _request, "POST");
        }
        private destroyAuthentication(url: string, handle: number): Promise<string> {
            var destroyAuthentication = {
                authId: handle
            }
            var _request = JSON.stringify(destroyAuthentication);
            return this.submitData(url, "DestroyAuthentication", _request, "DELETE");
        }
    }
}
