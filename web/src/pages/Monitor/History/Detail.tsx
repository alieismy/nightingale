import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { Card, Table, Divider, Popconfirm, Icon, message } from 'antd';
import { Link } from 'react-router-dom';
import moment from 'moment';
import _ from 'lodash';
import Graph, { Info } from '@cpts/Graph';
import CreateIncludeNsTree from '@cpts/Layout/CreateIncludeNsTree';
import request from '@common/request';
import api from '@common/api';
import { prefixCls, priorityOptions, eventTypeOptions } from '../config';
import './style.less';

const nPrefixCls = `${prefixCls}-history`;
export function normalizeGraphData(data: any) {
  const cloneData = _.cloneDeep(data);
  _.each(cloneData.metrics, (item) => {
    delete item.key;
    delete item.metrics;
    delete item.tagkv;
    delete item.counterList;
  });
  return cloneData;
}
class Detail extends Component<RouteComponentProps> {
  state: {
    loading: boolean,
    data: any,
  } = {
    loading: false,
    data: undefined,
  };

  componentDidMount() {
    this.fetchData(this.props);
  }

  componentWillReceiveProps = (nextProps: RouteComponentProps) => {
    const historyType = _.get(this.props, 'match.params.historyType');
    const nextHistoryType = _.get(nextProps, 'match.params.historyType');
    const historyId = _.get(this.props, 'match.params.historyId');
    const nextHistoryId = _.get(nextProps, 'match.params.historyId');

    if (historyType !== nextHistoryType || historyId !== nextHistoryId) {
      this.fetchData(nextProps);
    }
  }

  fetchData(props?: RouteComponentProps) {
    const historyType = _.get(props, 'match.params.historyType');
    const historyId = _.get(props, 'match.params.historyId');

    if (historyType && historyId) {
      this.setState({ loading: true });
      request(`${api.event}/${historyType}/${historyId}`).then((res) => {
        this.setState({ data: res });
      }).finally(() => {
        this.setState({ loading: false });
      });
    }
  }

  handleClaim = (id: number) => {
    request(`${api.event}/curs/claim`, {
      method: 'POST',
      body: JSON.stringify({ id: _.toNumber(id) }),
    }).then(() => {
      message.success('认领报警成功！');
      this.fetchData(this.props);
    });
  }

  handleShareGraph = (graphData: any) => {
    const data = normalizeGraphData(graphData);
    const configsList = [{
      configs: JSON.stringify(data),
    }];
    request(api.tmpchart, {
      method: 'POST',
      body: JSON.stringify(configsList),
    }).then((res) => {
      window.open(`/#/monitor/tmpchart?ids=${_.join(res, ',')}`, '_blank');
    });
  }

  render() {
    const { data } = this.state;
    const detail = _.get(data, 'detail[0]');

    if (!data || !detail) return null;
    const now = (new Date()).getTime();
    let etime = data.etime * 1000;
    let stime = etime - 7200000;

    if (now - etime > 3600000) {
      stime = etime - 3600000;
      etime += 3600000;
    }

    const xAxisPlotLines = _.map(detail.points, (point) => {
      return {
        value: point.timestamp * 1000,
        color: 'red',
      };
    });

    let selectedTagkv = [{
      tagk: 'endpoint',
      tagv: [data.endpoint],
    }];

    if (data.tags) {
      selectedTagkv = _.concat(selectedTagkv, _.map(detail.tags, (value, key) => {
        return {
          tagk: key,
          tagv: [value],
        };
      }));
    }

    const historyType = _.get(this.props, 'match.params.historyType');
    const historyId = _.get(this.props, 'match.params.historyId');
    const { nid } = data;
    const graphData: any[] = [];
    const points: any[] = [];
    _.forEach(data.detail, (item) => {
      graphData.push({
        id: (new Date()).getTime(),
        start: stime,
        end: etime,
        xAxis: {
          plotLines: xAxisPlotLines,
        },
        metrics: [{
          selectedNid: data.nid,
          selectedEndpoint: [data.endpoint],
          selectedMetric: item.metric,
          selectedTagkv,
        }],
      });
      points.push({
        metric: item.metric,
        points: item.points,
      });
    });

    return (
      <div className={nPrefixCls}>
        <div style={{ border: '1px solid #e8e8e8' }}>
          {
            _.map(graphData, (item) => {
              return (
                <Graph
                  height={250}
                  graphConfigInnerVisible={false}
                  data={item}
                  extraRender={(graph: any) => {
                    return [
                      <span className="graph-operationbar-item" key="info">
                        <Info
                          graphConfig={graph.getGraphConfig(graph.props.data)}
                          counterList={graph.counterList}
                        >
                          <Icon type="info-circle-o" />
                        </Info>
                      </span>,
                      <span className="graph-extra-item" key="more">
                        <Icon type="arrows-alt" onClick={() => { this.handleShareGraph(item); }} />
                      </span>,
                    ];
                  }}
                />
              );
            })
          }
        </div>
        <div className={`${nPrefixCls}-detail mt10`}>
          <Card
            title="报警事件详情"
            bodyStyle={{
              padding: '10px 16px',
            }}
            extra={
              <span>
                <Link to={{
                  pathname: '/monitor/silence/add',
                  search: `${historyType}=${historyId}&nid=${nid}`,
                }}>
                  屏蔽
                </Link>
                {
                  historyType === 'cur' ?
                    <span>
                      <Divider type="vertical" />
                      <Popconfirm title="确定要认领这条报警吗?" onConfirm={() => this.handleClaim(historyId)}>
                        <a>认领</a>
                      </Popconfirm>
                    </span> : null
                }
              </span>
            }
          >
            <div className={`${nPrefixCls}-detail-list`}>
              <div>
                <span className="label">策略名称：</span>
                <Link target="_blank" to={{ pathname: `/monitor/strategy/${data.sid}` }}>{data.sname}</Link>
              </div>
              <div>
                <span className="label">报警状态：</span>
                {_.get(_.find(priorityOptions, { value: data.priority }), 'label')}
                <span style={{ paddingLeft: 8 }}>{_.get(_.find(eventTypeOptions, { value: data.event_type }), 'label')}</span>
              </div>
              <div>
                <span className="label">通知结果：</span>
                {_.join(data.status, ', ')}
              </div>
              <div>
                <span className="label">发生时间：</span>
                {moment.unix(data.etime).format('YYYY-MM-DD HH:mm:ss')}
              </div>
              <div>
                <span className="label">节点：</span>
                {data.node_path}
              </div>
              <div>
                <span className="label">endpoint：</span>
                {data.endpoint}
              </div>
              <div>
                <span className="label">指标：</span>
                {_.get(data.detail, '[0].metric')}
              </div>
              <div>
                <span className="label">tags：</span>
                {data.tags}
              </div>
              <div>
                <span className="label">表达式：</span>
                {data.info}
              </div>
              {
                _.map(points, (item) => {
                  return (
                    <div>
                      <div className="label">现场值：</div>
                      {item.metric}
                      <Table
                        style={{
                          display: 'block',
                          marginLeft: 80,
                        }}
                        size="small"
                        rowKey="timestamp"
                        dataSource={item.points}
                        columns={[
                          {
                            title: '时间',
                            dataIndex: 'timestamp',
                            width: 200,
                            render(text) {
                              return <span>{moment.unix(text).format('YYYY-MM-DD HH:mm:ss')}</span>;
                            },
                          }, {
                            title: '数值',
                            dataIndex: 'value',
                          },
                        ]}
                        pagination={false}
                      />
                    </div>
                  );
                })
              }
            </div>
          </Card>
        </div>
      </div>
    );
  }
}

export default CreateIncludeNsTree(Detail as any);
