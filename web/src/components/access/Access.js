import React, {Component} from 'react';
import Guacamole from 'guacamole-common-js';
import {
    Affix,
    Alert,
    Button,
    Card,
    Col,
    Drawer,
    Form,
    Input,
    message,
    Modal,
    Row,
    Space,
    Spin,
    Tooltip,
    Tree
} from 'antd'
import qs from "qs";
import request from "../../common/request";
import {prefix, server, wsServer} from "../../common/constants";
import {
    CloudDownloadOutlined,
    CloudUploadOutlined,
    DeleteOutlined,
    FolderAddOutlined,
    LoadingOutlined,
    ReloadOutlined,
    UploadOutlined
} from '@ant-design/icons';
import CopyOutlined from "@ant-design/icons/lib/icons/CopyOutlined";
import FolderOpenOutlined from "@ant-design/icons/lib/icons/FolderOpenOutlined";
import Upload from "antd/es/upload";
import {download, getToken} from "../../utils/utils";
import './Access.css'

const {TextArea} = Input;
const {DirectoryTree} = Tree;

const STATE_IDLE = 0;
const STATE_CONNECTING = 1;
const STATE_WAITING = 2;
const STATE_CONNECTED = 3;
const STATE_DISCONNECTING = 4;
const STATE_DISCONNECTED = 5;

const antIcon = <LoadingOutlined/>;

const formItemLayout = {
    labelCol: {span: 6},
    wrapperCol: {span: 14},
};

class Access extends Component {

    formRef = React.createRef()

    state = {
        sessionId: '',
        client: {},
        clipboardVisible: false,
        clipboardText: '',
        containerOverflow: 'hidden',
        containerWidth: 0,
        containerHeight: 0,
        fileSystemVisible: false,
        fileSystem: {
            loading: false,
            object: null,
            currentDirectory: '/',
            files: [],
        },
        uploadAction: '',
        uploadHeaders: {},
        keyboard: {},
        protocol: '',
        treeData: [],
        selectNode: {},
        confirmVisible: false,
        confirmLoading: false,
        uploadVisible: false,
        uploadLoading: false,
    };

    async componentDidMount() {

        let params = new URLSearchParams(this.props.location.search);
        let assetsId = params.get('assetsId');
        let protocol = params.get('protocol');
        let sessionId = await this.createSession(assetsId);

        this.setState({
            sessionId: sessionId,
            protocol: protocol
        });

        this.renderDisplay(sessionId, protocol);

        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('onfocus', this.onWindowFocus);
    }

    componentWillUnmount() {
        if (this.state.client) {
            this.state.client.disconnect();
        }

        window.removeEventListener('resize', this.onWindowResize);
        document.removeEventListener("onfocus", this.onWindowFocus);
    }

    sendClipboard(data) {
        let writer;

        // Create stream with proper mimetype
        const stream = this.state.client.createClipboardStream(data.type);

        // Send data as a string if it is stored as a string
        if (typeof data.data === 'string') {
            writer = new Guacamole.StringWriter(stream);
            writer.sendText(data.data);
            writer.sendEnd();
        } else {

            // Write File/Blob asynchronously
            writer = new Guacamole.BlobWriter(stream);
            writer.oncomplete = function clipboardSent() {
                writer.sendEnd();
            };

            // Begin sending data
            writer.sendBlob(data.data);
        }

        this.setState({
            clipboardText: data.data
        })
        if (this.state.protocol === 'ssh') {
            message.success('您输入的内容已复制到远程服务器上，使用右键将自动粘贴。');
        } else {
            message.success('您输入的内容已复制到远程服务器上');
        }

    }

    onTunnelStateChange = (state) => {
        console.log('onTunnelStateChange', state);
    };

    updateSessionStatus = async (sessionId) => {
        let result = await request.post(`/sessions/${sessionId}/content`);
        if (result.code !== 1) {
            message.error(result.message);
        }
    }

    onClientStateChange = (state) => {
        switch (state) {
            case STATE_IDLE:
                console.log('初始化');
                message.destroy();
                message.loading('正在初始化中...', 0);
                break;
            case STATE_CONNECTING:
                console.log('正在连接...');
                message.destroy();
                message.loading('正在努力连接中...', 0);
                break;
            case STATE_WAITING:
                console.log('正在等待...');
                message.destroy();
                message.loading('正在等待服务器响应...', 0);
                break;
            case STATE_CONNECTED:
                console.log('连接成功。');
                this.onWindowResize(null);
                message.destroy();
                message.success('连接成功');
                // 向后台发送请求，更新会话的状态
                this.updateSessionStatus(this.state.sessionId).then(_ => {
                })
                break;
            case STATE_DISCONNECTING:
                console.log('连接正在关闭中...');
                message.destroy();
                message.loading('正在关闭连接...', 0);
                break;
            case STATE_DISCONNECTED:
                console.log('连接关闭。');
                message.destroy();
                message.error('连接关闭');
                break;
            default:
                break;
        }
    };

    onError = (status) => {

        console.log('通道异常。', status);

        switch (status.code) {
            case 256:
                this.showMessage('未支持的访问');
                break;
            case 512:
                this.showMessage('远程服务异常');
                break;
            case 513:
                this.showMessage('服务器忙碌');
                break;
            case 514:
                this.showMessage('服务器连接超时');
                break;
            case 515:
                this.showMessage('远程服务异常');
                break;
            case 516:
                this.showMessage('资源未找到');
                break;
            case 517:
                this.showMessage('资源冲突');
                break;
            case 518:
                this.showMessage('资源已关闭');
                break;
            case 519:
                this.showMessage('远程服务未找到');
                break;
            case 520:
                this.showMessage('远程服务不可用');
                break;
            case 521:
                this.showMessage('会话冲突');
                break;
            case 522:
                this.showMessage('会话连接超时');
                break;
            case 523:
                this.showMessage('会话已关闭');
                break;
            case 768:
                this.showMessage('网络不可达');
                break;
            case 769:
                this.showMessage('服务器密码验证失败');
                break;
            case 771:
                this.showMessage('客户端被禁止');
                break;
            case 776:
                this.showMessage('客户端连接超时');
                break;
            case 781:
                this.showMessage('客户端异常');
                break;
            case 783:
                this.showMessage('错误的请求类型');
                break;
            case 797:
                this.showMessage('客户端连接数量过多');
                break;
            default:
                this.showMessage('未知错误。');
        }
    };

    showMessage(message) {
        Modal.error({
            title: '提示',
            content: message,
        });
    }

    clientClipboardReceived = (stream, mimetype) => {
        let reader;

        // If the received data is text, read it as a simple string
        if (/^text\//.exec(mimetype)) {

            reader = new Guacamole.StringReader(stream);

            // Assemble received data into a single string
            let data = '';
            reader.ontext = function textReceived(text) {
                data += text;
            };

            // Set clipboard contents once stream is finished
            reader.onend = async () => {

                message.success('您选择的内容已复制到您的粘贴板中，在右侧的输入框中可同时查看到。');
                this.setState({
                    clipboardText: data
                });

                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(data);
                }

            };

        }

        // Otherwise read the clipboard data as a Blob
        else {
            reader = new Guacamole.BlobReader(stream, mimetype);
            reader.onend = () => {
                this.setState({
                    clipboardText: reader.getBlob()
                })
            }
        }
    };

    uploadChange = (info) => {
        if (info.file.status !== 'uploading') {

        }
        if (info.file.status === 'done') {
            message.success(`${info.file.name} 文件上传成功。`, 3);
        } else if (info.file.status === 'error') {
            message.error(`${info.file.name} 文件上传失败。`, 10);
        }
    }

    onKeyDown = (keysym) => {
        if (true === this.state.clipboardVisible || true === this.state.confirmVisible) {
            return true;
        }

        this.state.client.sendKeyEvent(1, keysym);
        if (keysym === 65288) {
            return false;
        }
    };

    onKeyUp = (keysym) => {
        this.state.client.sendKeyEvent(0, keysym);
    };

    showFileSystem = () => {
        this.setState({
            fileSystemVisible: true,
        });

        this.loadDirData('/');
    };

    hideFileSystem = () => {
        this.setState({
            fileSystemVisible: false,
        });
    };

    showClipboard = () => {
        this.setState({
            clipboardVisible: true
        }, () => {
            let element = document.getElementById('clipboard');
            if (element) {
                element.value = this.state.clipboardText;
            }

        });
    };

    hideClipboard = () => {
        this.setState({
            clipboardVisible: false
        });
    };

    updateClipboardFormTextarea = () => {
        let clipboardText = document.getElementById('clipboard').value;

        this.setState({
            clipboardText: clipboardText
        });

        this.sendClipboard({
            'data': clipboardText,
            'type': 'text/plain'
        });
    };

    async createSession(assetsId) {
        let result = await request.post(`/sessions?assetId=${assetsId}`);
        if (result.code !== 1) {
            message.error(result.message, 10);
            return;
        }
        return result.data['id'];
    }

    async renderDisplay(sessionId, protocol) {

        let tunnel = new Guacamole.WebSocketTunnel(wsServer + prefix + '/tunnel');

        tunnel.onstatechange = this.onTunnelStateChange;
        // Get new client instance
        let client = new Guacamole.Client(tunnel);

        // 设置虚拟机剪贴板内容
        client.sendClipboard = this.sendClipboard;

        // 处理从虚拟机收到的剪贴板内容
        client.onclipboard = this.clientClipboardReceived;

        // 处理客户端的状态变化事件
        client.onstatechange = this.onClientStateChange;

        client.onerror = this.onError;

        // Get display div from document
        const display = document.getElementById("display");

        // Add client to display div
        const element = client.getDisplay().getElement();
        display.appendChild(element);

        let width = window.innerWidth;
        let height = window.innerHeight;

        let token = getToken();

        let params = {
            'sessionId': sessionId,
            'width': width,
            'height': height,
            'X-Auth-Token': token
        };

        let paramStr = qs.stringify(params);

        // Connect
        client.connect(paramStr);

        // Disconnect on close
        window.onunload = function () {
            client.disconnect();
        };

        // Mouse
        const mouse = new Guacamole.Mouse(element);

        mouse.onmousedown = mouse.onmouseup = function (mouseState) {
            client.sendMouseState(mouseState);
        };

        mouse.onmousemove = function (mouseState) {
            if (protocol === 'ssh' || protocol === 'telnet') {
                mouseState.x = mouseState.x * 2;
                mouseState.y = mouseState.y * 2;
                client.sendMouseState(mouseState);
            } else {
                client.sendMouseState(mouseState);
            }
        };

        // Keyboard
        const keyboard = new Guacamole.Keyboard(document);

        keyboard.onkeydown = this.onKeyDown;
        keyboard.onkeyup = this.onKeyUp;
        this.setState({
            client: client,
            containerWidth: width,
            containerHeight: height,
            keyboard: keyboard
        });
    }

    onWindowResize = (e) => {

        if (this.state.client) {
            const display = this.state.client.getDisplay();

            const width = window.innerWidth;
            const height = window.innerHeight;

            if (this.state.protocol === 'ssh' || this.state.protocol === 'telnet') {
                let r = 2;
                display.scale(1 / r);
                this.state.client.sendSize(width * r, height * r);
            } else {
                this.state.client.sendSize(width, height);
            }

            this.setState({
                containerWidth: width,
                containerHeight: height,
            })

            this.resize(this.state.sessionId, width, height).then(_ => {
            });
        }
    };

    resize = async (sessionId, width, height) => {
        let result = await request.post(`/sessions/${sessionId}/resize?width=${width}&height=${height}`);
        if (result.code !== 1) {
            message.error(result.message);
        }
    }

    onWindowFocus = (e) => {
        if (navigator.clipboard) {
            navigator.clipboard.readText().then((text) => {
                this.sendClipboard({
                    'data': text,
                    'type': 'text/plain'
                });
            })
        }
    };

    onPaste = (e) => {
        const cbd = e.clipboardData;
        const ua = window.navigator.userAgent;

        // 如果是 Safari 直接 return
        if (!(e.clipboardData && e.clipboardData.items)) {
            return;
        }

        // Mac平台下Chrome49版本以下 复制Finder中的文件的Bug Hack掉
        if (cbd.items && cbd.items.length === 2 && cbd.items[0].kind === "string" && cbd.items[1].kind === "file" &&
            cbd.types && cbd.types.length === 2 && cbd.types[0] === "text/plain" && cbd.types[1] === "Files" &&
            ua.match(/Macintosh/i) && Number(ua.match(/Chrome\/(\d{2})/i)[1]) < 49) {
            return;
        }

        for (let i = 0; i < cbd.items.length; i++) {
            let item = cbd.items[i];
            if (item.kind === "file") {
                let blob = item.getAsFile();
                if (blob.size === 0) {
                    return;
                }
                // blob 就是从剪切板获得的文件 可以进行上传或其他操作
            } else if (item.kind === 'string') {
                item.getAsString((str) => {
                    this.sendClipboard({
                        'data': str,
                        'type': 'text/plain'
                    });
                })
            }
        }
    };

    onSelect = (keys, event) => {
        this.setState({
            selectNode: {
                key: keys[0],
                isLeaf: event.node.isLeaf
            }
        })
    };

    handleOk = async (values) => {
        let params = {
            'dir': this.state.selectNode.key + '/' + values['dir']
        }
        let paramStr = qs.stringify(params);

        this.setState({
            confirmLoading: true
        })
        let result = await request.post(`/sessions/${this.state.sessionId}/mkdir?${paramStr}`);
        if (result.code === 1) {
            message.success('创建成功');
            let parentPath = this.state.selectNode.key;
            let items = await this.getTreeNodes(parentPath);
            this.setState({
                treeData: this.updateTreeData(this.state.treeData, parentPath, items),
                selectNode: {}
            });
        } else {
            message.error(result.message);
        }

        this.setState({
            confirmLoading: false,
            confirmVisible: false
        })
    }

    handleConfirmCancel = () => {
        this.setState({
            confirmVisible: false
        })
    }

    handleUploadCancel = () => {
        this.setState({
            uploadVisible: false
        })
    }

    mkdir = () => {
        if (!this.state.selectNode.key || this.state.selectNode.isLeaf) {
            message.warning('请选择一个目录');
            return;
        }
        this.setState({
            confirmVisible: true
        })
    }

    upload = () => {
        if (!this.state.selectNode.key || this.state.selectNode.isLeaf) {
            message.warning('请选择一个目录进行上传');
            return;
        }
        this.setState({
            uploadVisible: true
        })
    }

    download = () => {
        if (!this.state.selectNode.key || !this.state.selectNode.isLeaf) {
            message.warning('当前只支持下载文件');
            return;
        }
        download(`${server}${prefix}/sessions/${this.state.sessionId}/download?file=${this.state.selectNode.key}`);
    }

    rmdir = async () => {
        if (!this.state.selectNode.key) {
            message.warning('请选择一个文件或目录');
            return;
        }
        let result;
        if (this.state.selectNode.isLeaf) {
            result = await request.delete(`/sessions/${this.state.sessionId}/rm?file=${this.state.selectNode.key}`);
        } else {
            result = await request.delete(`/sessions/${this.state.sessionId}/rmdir?dir=${this.state.selectNode.key}`);
        }
        if (result.code !== 1) {
            message.error(result.message);
        } else {
            message.success('删除成功');
            let path = this.state.selectNode.key;
            let parentPath = path.substring(0, path.lastIndexOf('/'));
            let items = await this.getTreeNodes(parentPath);
            this.setState({
                treeData: this.updateTreeData(this.state.treeData, parentPath, items),
                selectNode: {}
            });
        }
    }

    refresh = async () => {
        if (!this.state.selectNode.key || this.state.selectNode.isLeaf) {
            await this.loadDirData('/');
        } else {
            let key = this.state.selectNode.key;
            let items = await this.getTreeNodes(key);
            this.setState({
                treeData: this.updateTreeData(this.state.treeData, key, items),
            });
        }
        message.success('刷新目录成功');
    }

    onRightClick = ({event, node}) => {

    };

    loadDirData = async (key) => {
        let items = await this.getTreeNodes(key);
        this.setState({
            treeData: items,
        });
    }

    getTreeNodes = async (key) => {
        const url = server + prefix + '/sessions/' + this.state.sessionId + '/ls?dir=' + key;

        let result = await request.get(url);

        if (result.code !== 1) {
            return [];
        }

        let data = result.data;

        data = data.sort(((a, b) => a.name.localeCompare(b.name)));

        return data.map(item => {
            return {
                title: item['name'],
                key: item['path'],
                isLeaf: !item['isDir'] && !item['isLink'],
            }
        });
    }

    onLoadData = ({key, children}) => {

        return new Promise(async (resolve) => {
            if (children) {
                resolve();
                return;
            }

            let items = await this.getTreeNodes(key);
            this.setState({
                treeData: this.updateTreeData(this.state.treeData, key, items),
            });

            resolve();
        });
    }

    updateTreeData = (list, key, children) => {
        return list.map((node) => {
            if (node.key === key) {
                return {...node, children};
            } else if (node.children) {
                return {...node, children: this.updateTreeData(node.children, key, children)};
            }

            return node;
        });
    }

    render() {

        const title = (
            <Row>
                <Space>
                    远程文件管理
                    &nbsp;
                    &nbsp;
                    <Tooltip title="创建文件夹">
                        <Button type="primary" size="small" icon={<FolderAddOutlined/>}
                                onClick={this.mkdir} ghost/>
                    </Tooltip>

                    <Tooltip title="上传">
                        <Button type="primary" size="small" icon={<CloudUploadOutlined/>}
                                onClick={this.upload} ghost/>
                    </Tooltip>

                    <Tooltip title="下载">
                        <Button type="primary" size="small" icon={<CloudDownloadOutlined/>}
                                onClick={this.download} ghost/>
                    </Tooltip>

                    <Tooltip title="删除文件">
                        <Button type="dashed" size="small" icon={<DeleteOutlined/>} onClick={this.rmdir}
                                danger/>
                    </Tooltip>

                    <Tooltip title="刷新">
                        <Button type="primary" size="small" icon={<ReloadOutlined/>} onClick={this.refresh}
                                ghost/>
                    </Tooltip>
                </Space>
            </Row>
        );

        return (
            <div>

                <div className="container" style={{
                    overflow: this.state.containerOverflow,
                    width: this.state.containerWidth,
                    height: this.state.containerHeight
                }}>
                    <div id="display"/>
                </div>

                <Modal
                    title="创建文件夹"
                    visible={this.state.confirmVisible}
                    onOk={() => {
                        this.formRef.current
                            .validateFields()
                            .then(values => {
                                this.formRef.current.resetFields();
                                this.handleOk(values);
                            })
                            .catch(info => {

                            });
                    }}
                    confirmLoading={this.state.confirmLoading}
                    onCancel={this.handleConfirmCancel}
                >
                    <Form ref={this.formRef} {...formItemLayout}>

                        <Form.Item label="文件夹名称" name='dir' rules={[{required: true, message: '请输入文件夹名称'}]}>
                            <Input autoComplete="off" placeholder="请输入文件夹名称"/>
                        </Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title="上传文件"
                    visible={this.state.uploadVisible}
                    onOk={() => {

                    }}
                    confirmLoading={this.state.uploadLoading}
                    onCancel={this.handleUploadCancel}
                >
                    <Upload
                        action={server + prefix + '/sessions/' + this.state.sessionId + '/upload?X-Auth-Token=' + getToken() + '&dir=' + this.state.selectNode.key}>
                        <Button icon={<UploadOutlined/>}>上传文件</Button>
                    </Upload>
                </Modal>

                <Affix style={{position: 'absolute', top: 50, right: 100}}>
                    <Button
                        icon={<CopyOutlined/>}
                        onClick={() => {
                            this.showClipboard();
                        }}
                    >
                    </Button>

                </Affix>

                <Affix style={{position: 'absolute', top: 50, right: 50}}>
                    <Button
                        icon={<FolderOpenOutlined/>}
                        onClick={() => {
                            this.showFileSystem();
                        }}
                    >
                    </Button>
                </Affix>

                <Drawer
                    title={title}
                    placement="right"
                    width={window.innerWidth * 0.3}
                    closable={true}
                    maskClosable={false}
                    onClose={this.hideFileSystem}
                    visible={this.state.fileSystemVisible}
                >


                    <Row style={{marginTop: 10}}>
                        <Col span={24}>
                            <Card title={this.state.fileSystem.currentDirectory} bordered={true} size="small">
                                <Spin indicator={antIcon} spinning={this.state.fileSystem.loading}>

                                    <DirectoryTree
                                        // multiple
                                        onSelect={this.onSelect}
                                        loadData={this.onLoadData}
                                        treeData={this.state.treeData}
                                        onRightClick={this.onRightClick}
                                    />

                                </Spin>
                            </Card>
                        </Col>
                    </Row>
                </Drawer>

                <Drawer
                    title="剪贴板"
                    placement="right"
                    width={window.innerWidth * 0.3}
                    onClose={this.hideClipboard}
                    visible={this.state.clipboardVisible}
                >

                    <Alert message="复制/剪切的文本将出现在这里。对下面文本内容所作的修改将会影响远程电脑上的剪贴板。" type="info" showIcon closable/>

                    <div style={{marginTop: 10, marginBottom: 10}}>
                        <TextArea id='clipboard' rows={10} onBlur={this.updateClipboardFormTextarea}/>
                    </div>

                </Drawer>
            </div>
        );
    }
}

export default Access;
