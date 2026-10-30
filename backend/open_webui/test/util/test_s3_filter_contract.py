import datetime as dt

import boto3
import pytest
from botocore.exceptions import ClientError
from botocore.stub import Stubber
from open_webui.retrieval.vector.dbs.s3vector import S3VectorClient


def test_s3_filters_preserve_short_circuit_pagination_and_deletion_selection() -> None:
    client = object.__new__(S3VectorClient)
    client.bucket_name = 'fixture-bucket'
    client.client = boto3.client(
        's3vectors', region_name='us-east-1', aws_access_key_id='fixture', aws_secret_access_key='fixture'
    )
    metadata = {'source': 'wanted', 'empty': None, 'number': 0}
    for condition, expected in (
        ({}, True),
        (None, False),
        ({'source': 'wanted'}, True),
        ({'missing': None}, True),
        ({'source': {'$eq': 'wanted', '$ne': 'other'}}, True),
        ({'source': {'$in': ['wanted'], '$nin': ['other']}}, True),
        ({'source': {'$in': 'wanted'}}, False),
        ({'source': {'$nin': 'wanted'}}, True),
        ({'missing': {'$exists': False}}, True),
        ({'empty': {'$exists': True}}, True),
        ({'number': {'$eq': False}}, True),
        ({'source': {'$unknown': object()}}, True),
        ({'$unknown': [None]}, True),
        ({'$and': []}, True),
        ({'$or': []}, False),
        ({'$and': 'ignored', '$or': None}, True),
        ({'$and': [{'source': 'other'}, {None: 'must not evaluate'}]}, False),
        ({'$or': [{'source': 'wanted'}, {None: 'must not evaluate'}]}, True),
        ({'$and': [{'$or': [{'source': 'wanted'}, {'source': 'other'}]}, {'empty': None}]}, True),
    ):
        assert client._matches_filter(metadata, condition) is expected
    assert not client._matches_filter(None, {})
    with pytest.raises(AttributeError):
        client._matches_filter(metadata, {'$and': [{None: 'evaluated'}]})

    stub = Stubber(client.client)
    index_params = {'vectorBucketName': client.bucket_name, 'indexName': 'file-fixture'}
    index = {
        'vectorBucketName': client.bucket_name,
        'indexName': 'file-fixture',
        'indexArn': 'arn:aws:s3vectors:us-east-1:123456789012:bucket/fixture-bucket/index/file-fixture',
        'creationTime': dt.datetime(2026, 1, 1, tzinfo=dt.UTC),
        'dataType': 'float32',
        'dimension': 3,
        'distanceMetric': 'cosine',
    }
    list_params = {**index_params, 'returnData': False, 'returnMetadata': True, 'maxResults': 500}
    first = {'key': 'one', 'metadata': {'source': 'wanted', 'text': '', 'content': 'First'}}
    second = {'key': 'two', 'metadata': {'source': 'other', 'text': 'Second'}}
    third = {'key': 'three', 'metadata': {'source': 'wanted', 'document': 'Third'}}
    for checks in (2, 3):
        for _ in range(checks):
            stub.add_response('get_index', {'index': index}, index_params)
        stub.add_response('list_vectors', {'vectors': [first, second], 'nextToken': 'page-2'}, list_params)
        stub.add_response('list_vectors', {'vectors': [third]}, {**list_params, 'nextToken': 'page-2'})
    stub.add_response('get_index', {'index': index}, index_params)
    stub.add_response('delete_vectors', {}, {**index_params, 'keys': ['one', 'three']})
    query_params = {
        **index_params,
        'topK': 10,
        'queryVector': {'float32': [1.0, 2.0, 3.0]},
        'returnMetadata': True,
        'returnDistance': True,
    }
    for code in ('NotFoundException', 'AccessDeniedException', 'ValidationException', 'InternalServerException'):
        stub.add_response('get_index', {'index': index}, index_params)
        stub.add_client_error('query_vectors', service_error_code=code, expected_params=query_params)
    with stub:
        result = client.query('file-fixture', {'source': 'wanted'}, limit=1)
        assert result.model_dump() == {'ids': [['one']], 'documents': [['First']], 'metadatas': [[first['metadata']]]}
        client.delete('file-fixture', filter={'source': 'wanted'})
        for _ in range(3):
            assert client.search('file-fixture', [[1, 2, 3]]) is None
        with pytest.raises(ClientError):
            client.search('file-fixture', [[1, 2, 3]])
        stub.assert_no_pending_responses()
