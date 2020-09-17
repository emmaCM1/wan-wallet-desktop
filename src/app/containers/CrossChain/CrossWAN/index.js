import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Table, Row, Col, message } from 'antd';
import totalImg from 'static/image/wan.png';
import CopyAndQrcode from 'components/CopyAndQrcode';
import { INBOUND, OUTBOUND } from 'utils/settings';
import WANTrans from 'components/CrossChain/SendCrossChainTrans/WANTrans';
import CrossChainTransHistory from 'components/CrossChain/CrossChainTransHistory/CrossWANHistory';
import style from './index.less';

const CHAINTYPE = 'WAN';
const WANCHAIN = 'WAN';

@inject(stores => ({
  tokensList: stores.tokens.formatTokensList,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  getNormalAddrList: stores.wanAddress.getNormalAddrList,
  getAmount: stores.wanAddress.getNormalAmount,
  getTokensListInfo: stores.tokens.getTokensListInfo,
  transParams: stores.sendCrossChainParams.transParams,
  tokenPairs: stores.crossChain.tokenPairs,
  setCurrSymbol: symbol => stores.crossChain.setCurrSymbol(symbol),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  setCurrToken: (addr, symbol) => stores.tokens.setCurrToken(addr, symbol),
  setCurrTokenChain: chain => stores.tokens.setCurrTokenChain(chain),
  updateTokensBalance: (...args) => stores.tokens.updateTokensBalance(...args),
  setCurrTokenPairId: id => stores.crossChain.setCurrTokenPairId(id),
}))

@observer
class CrossWAN extends Component {
  constructor (props) {
    super(props);
    const { tokenPairs, match } = props;
    let tokenPairID = match.params.tokenPairId;
    this.props.setCurrSymbol(CHAINTYPE);
    this.props.changeTitle('Common.crossChain');
    this.props.setCurrTokenPairId(tokenPairID);
    this.info = tokenPairs[tokenPairID];
    this.props.setCurrToken(this.info.toAccount);
    this.props.setCurrTokenChain(this.info.toChainSymbol);
  }

  componentDidMount() {
    this.props.updateTokensBalance(this.info.toAccount, this.info.toChainSymbol);
    this.timer = setInterval(() => {
      this.props.updateTokensBalance(this.info.toAccount, this.info.toChainSymbol);
    }, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  inboundHandleSend = from => {
    const { tokenPairs, match } = this.props;
    let tokenPairID = match.params.tokenPairId;
    let info = this.info;
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
        // console.log('WAN inbound result:', err, ret);
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
    let info = this.info;
    let transParams = this.props.transParams[from];
    let input = {
      from: transParams.from,
      to: transParams.to,
      amount: transParams.amount,
      gasPrice: transParams.gasPrice,
      gasLimit: transParams.gasLimit,
      storeman: transParams.storeman,
      // txFeeRatio: transParams.txFeeRatio
      tokenPairID: tokenPairID,
      crossType: transParams.crossType
    };
    return new Promise((resolve, reject) => {
      wand.request('crossChain_crossChain', { input, tokenPairID, sourceSymbol: info.toChainSymbol, sourceAccount: info.toAccount, destinationSymbol: info.fromChainSymbol, destinationAccount: info.fromAccount, type: 'LOCK' }, (err, ret) => {
        // console.log('WAN outbound result:', err, ret);
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
      render: (text, record) => <div><WANTrans balance={record.balance} from={record.address} record={record} chainPairId={this.props.match.params.tokenPairId} path={record.path} handleSend={this.inboundHandleSend} chainType={this.info.fromChainSymbol} type={INBOUND}/></div>
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
      render: (text, record) => <div><WANTrans balance={record.balance} from={record.address} record={record} chainPairId={this.props.match.params.tokenPairId} path={record.path} handleSend={this.outboundHandleSend} chainType={this.info.toChainSymbol} type={OUTBOUND}/></div>
    }
  ];

  render () {
    const { getNormalAddrList, getTokensListInfo } = this.props;
    this.props.language && this.inboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    })
    this.props.language && this.outboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    })
    let info = this.info;

    return (
      <div className="account">
        <Row className="title">
          <Col span={12} className="col-left"><img className="totalImg" src={totalImg} /><span className="wanTotal">{info.fromTokenName} </span><span className={style.chain}>{info.fromChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.inboundColumns} dataSource={getNormalAddrList} />
          </Col>
        </Row>
        <Row className="title">
          <Col span={12} className="col-left"><img className="totalImg" src={totalImg} /><span className="wanTotal">{info.toTokenName} </span><span className={style.chain}>{info.toChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.outboundColumns} dataSource={getTokensListInfo} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <CrossChainTransHistory name={['normal']} symbol='ETH' />
          </Col>
        </Row>
      </div>
    );
  }
}

export default CrossWAN;