import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Table, Row, Col, message } from 'antd';
import CopyAndQrcode from 'components/CopyAndQrcode';
import { INBOUND, OUTBOUND, COIN_ACCOUNT } from 'utils/settings';
import Trans from 'components/CrossChain/SendCrossChainTrans';
import CrossChainTransHistory from 'components/CrossChain/CrossChainTransHistory';
import wanLogo from 'static/image/wan.png';
import ethLogo from 'static/image/eth.png';
import btcLogo from 'static/image/btc.png';
import eosLogo from 'static/image/eos.png';
import style from './index.less';

@inject(stores => ({
  tokenIconList: stores.tokens.tokenIconList,
  language: stores.languageIntl.language,
  getNormalAddrList: stores.ethAddress.getNormalAddrList,
  getTokensListInfo: stores.tokens.getTokensListInfo,
  tokensBalance: stores.tokens.tokensBalance,
  stores: stores,
  transParams: stores.sendCrossChainParams.transParams,
  tokenPairs: stores.crossChain.tokenPairs,
  currTokenPairId: stores.crossChain.currTokenPairId,
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  getTokenIcon: (tokenScAddr) => stores.tokens.getTokenIcon(tokenScAddr),
  setCurrToken: (addr, symbol) => stores.tokens.setCurrToken(addr, symbol),
  updateTokensBalance: (...args) => stores.tokens.updateTokensBalance(...args),
  getCoinsListInfo_2way: (...args) => stores.tokens.getCoinsListInfo_2way(...args),
  getTokensListInfo_2way: (...args) => stores.tokens.getTokensListInfo_2way(...args),
  setCurrSymbol: symbol => stores.crossChain.setCurrSymbol(symbol),
  setCurrTokenPairId: id => stores.crossChain.setCurrTokenPairId(id),
}))

@observer
class CrossChain extends Component {
  constructor(props) {
    super(props);
    const { match, changeTitle } = this.props;
    changeTitle('Common.crossChain');
    const tokenPairId = match.params.tokenPairId;
    this.init(tokenPairId);
  }

  init = (id) => {
    const { tokenPairs, setCurrToken, setCurrTokenPairId, setCurrSymbol } = this.props;
    const { fromAccount, ancestorSymbol } = tokenPairs[id];
    setCurrToken(fromAccount);
    setCurrTokenPairId(id);
    setCurrSymbol(ancestorSymbol);
  }

  componentWillReceiveProps(newProps) {
    let id = newProps.match.params.tokenPairId;
    if (id !== this.props.currTokenPairId) {
      this.init(id);
    }
  }

  componentDidMount() {
    const { updateTokensBalance, tokenPairs, match } = this.props;
    const tokenPairId = match.params.tokenPairId;
    const { fromAccount, toAccount, fromChainSymbol, toChainSymbol } = tokenPairs[tokenPairId];
    let updateBalance = () => {
      if (fromAccount !== COIN_ACCOUNT) {
        updateTokensBalance(fromAccount, fromChainSymbol);
      }
      if (toAccount !== COIN_ACCOUNT) {
        updateTokensBalance(toAccount, toChainSymbol);
      }
    }
    updateBalance();
    this.timer = setInterval(updateBalance, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  inboundHandleSend = from => {
    const { tokenPairs, match } = this.props;
    let tokenPairID = match.params.tokenPairId;
    let info = tokenPairs[tokenPairID];
    let transParams = this.props.transParams[from];
    let input = {
      from: transParams.from,
      to: transParams.to,
      amount: transParams.amount,
      gasPrice: transParams.gasPrice,
      gasLimit: transParams.gasLimit,
      storeman: transParams.storeman,
      tokenPairID: tokenPairID,
      crossType: transParams.crossType
    };
    return new Promise((resolve, reject) => {
      wand.request('crossChain_crossChain', { input, tokenPairID, sourceSymbol: info.fromChainSymbol, sourceAccount: info.fromAccount, destinationSymbol: info.toChainSymbol, destinationAccount: info.toAccount, type: 'LOCK' }, (err, ret) => {
        console.log('inbound result:', err, ret);
        if (err) {
          if (err instanceof Object && err.desc && err.desc instanceof Array && err.desc.includes('ready')) {
            message.warn(intl.get('Common.networkError'));
          } else {
            message.warn(intl.get('Common.sendFailed'));
          }
          return reject(err);
        } else {
          if (ret.code) {
            message.success(intl.get('Send.transSuccess'));
            return resolve(ret);
          } else {
            message.warn(intl.get('Common.sendFailed'));
            return reject(ret);
          }
        }
      })
    });
  }

  outboundHandleSend = from => {
    const { tokenPairs, match } = this.props;
    let tokenPairID = match.params.tokenPairId;
    let info = tokenPairs[tokenPairID];
    let transParams = this.props.transParams[from];
    let input = {
      from: transParams.from,
      to: transParams.to,
      amount: transParams.amount,
      gasPrice: transParams.gasPrice,
      gasLimit: transParams.gasLimit,
      storeman: transParams.storeman,
      tokenPairID: tokenPairID,
      crossType: transParams.crossType
    };

    return new Promise((resolve, reject) => {
      wand.request('crossChain_crossChain', { input, tokenPairID, sourceSymbol: info.toChainSymbol, sourceAccount: info.toAccount, destinationSymbol: info.fromChainSymbol, destinationAccount: info.fromAccount, type: 'LOCK' }, (err, ret) => {
        console.log('outbound result:', err, ret);
        if (err) {
          if (err instanceof Object && err.desc && err.desc instanceof Array && err.desc.includes('ready')) {
            message.warn(intl.get('Common.networkError'));
          } else {
            message.warn(intl.get('Common.sendFailed'));
          }
          return reject(err);
        } else {
          if (ret.code) {
            message.success(intl.get('Send.transSuccess'));
            return resolve(ret);
          } else {
            message.success(intl.get('Common.sendFailed'));
            return reject(ret);
          }
        }
      })
    })
  }

  getCoinImage = (text, addr = false) => {
    let img;
    switch (text.toUpperCase()) {
      case 'WAN':
        img = wanLogo;
        break;
      case 'ETH':
        img = ethLogo;
        break;
      case 'BTC':
        img = btcLogo;
        break;
      case 'EOS':
        img = eosLogo;
        break;
      default:
        if (addr) {
          if (!this.props.tokenIconList[addr]) {
            this.props.getTokenIcon(addr);
          }
          img = this.props.tokenIconList[addr];
        }
    }
    return <img className="totalImg" src={img} />;
  }

  inboundColumns = [
    {
      dataIndex: 'name',
      width: '20%',
      ellipsis: true
    },
    {
      dataIndex: 'address',
      width: '50%',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      width: '20%',
      ellipsis: true,
      sorter: (a, b) => a.balance - b.balance,
    },
    {
      dataIndex: 'action',
      width: '10%',
      render: (text, record) => <div><Trans balance={record.balance} from={record.address} account={record.name} path={record.path} handleSend={this.inboundHandleSend} type={INBOUND} chainPairId={this.props.match.params.tokenPairId} /></div>
    }
  ];

  outboundColumns = [
    {
      dataIndex: 'name',
      width: '20%',
      ellipsis: true
    },
    {
      dataIndex: 'address',
      width: '50%',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      width: '20%',
      ellipsis: true,
      sorter: (a, b) => a.balance - b.balance,
    },
    {
      dataIndex: 'action',
      width: '10%',
      render: (text, record) => <div><Trans balance={record.balance} from={record.address} account={record.name} path={record.path} handleSend={this.outboundHandleSend} type={OUTBOUND} chainPairId={this.props.match.params.tokenPairId} /></div>
    }
  ];

  render() {
    const { getTokensListInfo_2way, getCoinsListInfo_2way, tokenPairs, match } = this.props;
    this.props.language && this.inboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    });

    this.props.language && this.outboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    });

    let tokenPairID = match.params.tokenPairId;
    let info = tokenPairs[tokenPairID];
    let fromAddresses = info.fromAccount === COIN_ACCOUNT ? getCoinsListInfo_2way(info.fromChainSymbol, info.fromChainID) : getTokensListInfo_2way(info.fromChainSymbol, info.fromChainID, info.fromAccount);
    let toAddresses = info.toAccount === COIN_ACCOUNT ? getCoinsListInfo_2way(info.toChainSymbol, info.toChainID) : getTokensListInfo_2way(info.toChainSymbol, info.toChainID, info.toAccount);
    // console.log('data:', fromAddresses, toAddresses)
    // console.log('info:', info)
    // console.log('tokenPairID:', tokenPairID)
    // console.log('props:', this.props)

    return (
      <div className="account">
        <Row className="title">
          <Col span={12} className="col-left">{this.getCoinImage(info.ancestorSymbol, info.toAccount)}<span className="wanTotal">{info.ancestorSymbol}</span><span className={style.chain}>{info.fromChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.inboundColumns} dataSource={fromAddresses} />
          </Col>
        </Row>
        <Row className="title">
          <Col span={12} className="col-left">{this.getCoinImage(info.ancestorSymbol, info.toAccount)}<span className="wanTotal">{info.ancestorSymbol}</span><span className={style.chain}>{info.toChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.outboundColumns} dataSource={toAddresses} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <CrossChainTransHistory />
          </Col>
        </Row>
      </div>
    );
  }
}

export default CrossChain;