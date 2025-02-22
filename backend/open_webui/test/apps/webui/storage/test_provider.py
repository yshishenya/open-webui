import io
import os
import boto3
import pytest
from botocore.exceptions import ClientError
from moto import mock_aws
from open_webui.storage import provider
from gcp_storage_emulator.server import create_server
from google.cloud import storage
from azure.storage.blob import BlobServiceClient, ContainerClient, BlobClient
from unittest.mock import MagicMock


def mock_upload_dir(monkeypatch, tmp_path):
    """Fixture to monkey-patch the UPLOAD_DIR and create a temporary directory."""
    directory = tmp_path / "uploads"
    directory.mkdir()
    monkeypatch.setattr(provider, "UPLOAD_DIR", str(directory))
    return directory


def test_imports():
    """Test the availability of storage provider classes.

    This function checks the importability of various storage provider
    classes within the provider module. It ensures that the classes are
    accessible and can be imported without any issues. This is particularly
    useful for verifying that the necessary dependencies are correctly
    installed and available in the environment.
    """

    provider.StorageProvider
    provider.LocalStorageProvider
    provider.S3StorageProvider
    provider.GCSStorageProvider
    provider.AzureStorageProvider
    provider.Storage


def test_get_storage_provider():
    """Test the retrieval of storage providers.

    This function tests the `get_storage_provider` method from the
    `provider` module to ensure that it correctly returns instances of the
    appropriate storage provider classes based on the input string. It
    checks for local, S3, GCS, and Azure storage providers and verifies that
    an invalid input raises a RuntimeError.
    """

    Storage = provider.get_storage_provider("local")
    assert isinstance(Storage, provider.LocalStorageProvider)
    Storage = provider.get_storage_provider("s3")
    assert isinstance(Storage, provider.S3StorageProvider)
    Storage = provider.get_storage_provider("gcs")
    assert isinstance(Storage, provider.GCSStorageProvider)
    Storage = provider.get_storage_provider("azure")
    assert isinstance(Storage, provider.AzureStorageProvider)
    with pytest.raises(RuntimeError):
        provider.get_storage_provider("invalid")


def test_class_instantiation():
    """Test the instantiation of storage provider classes.

    This function verifies that the appropriate exceptions are raised when
    attempting to instantiate storage provider classes without the required
    arguments. It checks that a TypeError is raised for the base class
    `StorageProvider` and for a subclass that does not provide the necessary
    initialization. Additionally, it confirms that the derived classes
    `LocalStorageProvider`, `S3StorageProvider`, `GCSStorageProvider`, and
    `AzureStorageProvider` can be instantiated without errors.
    """

    with pytest.raises(TypeError):
        provider.StorageProvider()
    with pytest.raises(TypeError):

        class Test(provider.StorageProvider):
            pass

        Test()
    provider.LocalStorageProvider()
    provider.S3StorageProvider()
    provider.GCSStorageProvider()
    provider.AzureStorageProvider()


class TestLocalStorageProvider:
    Storage = provider.LocalStorageProvider()
    file_content = b"test content"
    file_bytesio = io.BytesIO(file_content)
    filename = "test.txt"
    filename_extra = "test_exyta.txt"
    file_bytesio_empty = io.BytesIO()

    def test_upload_file(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        contents, file_path = self.Storage.upload_file(self.file_bytesio, self.filename)
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content
        assert contents == self.file_content
        assert file_path == str(upload_dir / self.filename)
        with pytest.raises(ValueError):
            self.Storage.upload_file(self.file_bytesio_empty, self.filename)

    def test_get_file(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        file_path = str(upload_dir / self.filename)
        file_path_return = self.Storage.get_file(file_path)
        assert file_path == file_path_return

    def test_delete_file(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        (upload_dir / self.filename).write_bytes(self.file_content)
        assert (upload_dir / self.filename).exists()
        file_path = str(upload_dir / self.filename)
        self.Storage.delete_file(file_path)
        assert not (upload_dir / self.filename).exists()

    def test_delete_all_files(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        (upload_dir / self.filename).write_bytes(self.file_content)
        (upload_dir / self.filename_extra).write_bytes(self.file_content)
        self.Storage.delete_all_files()
        assert not (upload_dir / self.filename).exists()
        assert not (upload_dir / self.filename_extra).exists()


@mock_aws
class TestS3StorageProvider:

    def __init__(self):
        self.Storage = provider.S3StorageProvider()
        self.Storage.bucket_name = "my-bucket"
        self.s3_client = boto3.resource("s3", region_name="us-east-1")
        self.file_content = b"test content"
        self.filename = "test.txt"
        self.filename_extra = "test_exyta.txt"
        self.file_bytesio_empty = io.BytesIO()
        super().__init__()

    def test_upload_file(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        # S3 checks
        with pytest.raises(Exception):
            self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        self.s3_client.create_bucket(Bucket=self.Storage.bucket_name)
        contents, s3_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        object = self.s3_client.Object(self.Storage.bucket_name, self.filename)
        assert self.file_content == object.get()["Body"].read()
        # local checks
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content
        assert contents == self.file_content
        assert s3_file_path == "s3://" + self.Storage.bucket_name + "/" + self.filename
        with pytest.raises(ValueError):
            self.Storage.upload_file(self.file_bytesio_empty, self.filename)

    def test_get_file(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        self.s3_client.create_bucket(Bucket=self.Storage.bucket_name)
        contents, s3_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        file_path = self.Storage.get_file(s3_file_path)
        assert file_path == str(upload_dir / self.filename)
        assert (upload_dir / self.filename).exists()

    def test_delete_file(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        self.s3_client.create_bucket(Bucket=self.Storage.bucket_name)
        contents, s3_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        assert (upload_dir / self.filename).exists()
        self.Storage.delete_file(s3_file_path)
        assert not (upload_dir / self.filename).exists()
        with pytest.raises(ClientError) as exc:
            self.s3_client.Object(self.Storage.bucket_name, self.filename).load()
        error = exc.value.response["Error"]
        assert error["Code"] == "404"
        assert error["Message"] == "Not Found"

    def test_delete_all_files(self, monkeypatch, tmp_path):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        # create 2 files
        self.s3_client.create_bucket(Bucket=self.Storage.bucket_name)
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        object = self.s3_client.Object(self.Storage.bucket_name, self.filename)
        assert self.file_content == object.get()["Body"].read()
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename_extra)
        object = self.s3_client.Object(self.Storage.bucket_name, self.filename_extra)
        assert self.file_content == object.get()["Body"].read()
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content

        self.Storage.delete_all_files()
        assert not (upload_dir / self.filename).exists()
        with pytest.raises(ClientError) as exc:
            self.s3_client.Object(self.Storage.bucket_name, self.filename).load()
        error = exc.value.response["Error"]
        assert error["Code"] == "404"
        assert error["Message"] == "Not Found"
        assert not (upload_dir / self.filename_extra).exists()
        with pytest.raises(ClientError) as exc:
            self.s3_client.Object(self.Storage.bucket_name, self.filename_extra).load()
        error = exc.value.response["Error"]
        assert error["Code"] == "404"
        assert error["Message"] == "Not Found"

        self.Storage.delete_all_files()
        assert not (upload_dir / self.filename).exists()
        assert not (upload_dir / self.filename_extra).exists()


class TestGCSStorageProvider:
    Storage = provider.GCSStorageProvider()
    Storage.bucket_name = "my-bucket"
    file_content = b"test content"
    filename = "test.txt"
    filename_extra = "test_exyta.txt"
    file_bytesio_empty = io.BytesIO()

    @pytest.fixture(scope="class")
    def setup(self):
        host, port = "localhost", 9023

        server = create_server(host, port, in_memory=True)
        server.start()
        os.environ["STORAGE_EMULATOR_HOST"] = f"http://{host}:{port}"

        gcs_client = storage.Client()
        bucket = gcs_client.bucket(self.Storage.bucket_name)
        bucket.create()
        self.Storage.gcs_client, self.Storage.bucket = gcs_client, bucket
        yield
        bucket.delete(force=True)
        server.stop()

    def test_upload_file(self, monkeypatch, tmp_path, setup):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        # catch error if bucket does not exist
        with pytest.raises(Exception):
            self.Storage.bucket = monkeypatch(self.Storage, "bucket", None)
            self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        contents, gcs_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        object = self.Storage.bucket.get_blob(self.filename)
        assert self.file_content == object.download_as_bytes()
        # local checks
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content
        assert contents == self.file_content
        assert gcs_file_path == "gs://" + self.Storage.bucket_name + "/" + self.filename
        # test error if file is empty
        with pytest.raises(ValueError):
            self.Storage.upload_file(self.file_bytesio_empty, self.filename)

    def test_get_file(self, monkeypatch, tmp_path, setup):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        contents, gcs_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        file_path = self.Storage.get_file(gcs_file_path)
        assert file_path == str(upload_dir / self.filename)
        assert (upload_dir / self.filename).exists()

    def test_delete_file(self, monkeypatch, tmp_path, setup):
        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        contents, gcs_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        # ensure that local directory has the uploaded file as well
        assert (upload_dir / self.filename).exists()
        assert self.Storage.bucket.get_blob(self.filename).name == self.filename
        self.Storage.delete_file(gcs_file_path)
        # check that deleting file from gcs will delete the local file as well
        assert not (upload_dir / self.filename).exists()
        assert self.Storage.bucket.get_blob(self.filename) == None

    def test_delete_all_files(self, monkeypatch, tmp_path, setup):
        """Test the deletion of all files in the storage.

        This test function uploads two files to a storage system, verifies their
        existence and content, and then calls the method to delete all files. It
        checks that both files are successfully deleted from the storage and
        that they no longer exist in the upload directory.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for temporary modifications
                of objects during the test.
            tmp_path (py.path.local): A pytest fixture that provides a temporary directory unique to
                the test invocation.
            setup (function): A setup function that prepares the test environment.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        # create 2 files
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        object = self.Storage.bucket.get_blob(self.filename)
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content
        assert self.Storage.bucket.get_blob(self.filename).name == self.filename
        assert self.file_content == object.download_as_bytes()
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename_extra)
        object = self.Storage.bucket.get_blob(self.filename_extra)
        assert (upload_dir / self.filename_extra).exists()
        assert (upload_dir / self.filename_extra).read_bytes() == self.file_content
        assert (
            self.Storage.bucket.get_blob(self.filename_extra).name
            == self.filename_extra
        )
        assert self.file_content == object.download_as_bytes()

        self.Storage.delete_all_files()
        assert not (upload_dir / self.filename).exists()
        assert not (upload_dir / self.filename_extra).exists()
        assert self.Storage.bucket.get_blob(self.filename) == None
        assert self.Storage.bucket.get_blob(self.filename_extra) == None


class TestAzureStorageProvider:
    def __init__(self):
        super().__init__()

    @pytest.fixture(scope="class")
    def setup_storage(self, monkeypatch):
        """Set up mock storage for testing Azure Blob Storage interactions.

        This method creates mock instances of the Blob Service Client, Container
        Client, and Blob Client using the `unittest.mock.MagicMock` class. It
        configures these mocks to return the appropriate clients when called.
        The method also monkeypatches the Azure Blob Storage classes to use the
        mock clients instead of the real ones, allowing for isolated testing
        without actual Azure storage interactions.

        Args:
            monkeypatch (pytest.MonkeyPatch): The monkeypatch fixture provided by pytest
                to modify the behavior of the Azure Blob Storage classes.

        Attributes:
            Storage (AzureStorageProvider): An instance of the AzureStorageProvider
                initialized with a specific endpoint and container name.
            file_content (bytes): The content of the file to be used in tests.
            filename (str): The name of the test file.
            filename_extra (str): An additional test file name.
            file_bytesio_empty (BytesIO): An empty BytesIO object for testing purposes.
        """

        # Create mock Blob Service Client and related clients
        mock_blob_service_client = MagicMock()
        mock_container_client = MagicMock()
        mock_blob_client = MagicMock()

        # Set up return values for the mock
        mock_blob_service_client.get_container_client.return_value = (
            mock_container_client
        )
        mock_container_client.get_blob_client.return_value = mock_blob_client

        # Monkeypatch the Azure classes to return our mocks
        monkeypatch.setattr(
            azure.storage.blob,
            "BlobServiceClient",
            lambda *args, **kwargs: mock_blob_service_client,
        )
        monkeypatch.setattr(
            azure.storage.blob,
            "ContainerClient",
            lambda *args, **kwargs: mock_container_client,
        )
        monkeypatch.setattr(
            azure.storage.blob, "BlobClient", lambda *args, **kwargs: mock_blob_client
        )

        self.Storage = provider.AzureStorageProvider()
        self.Storage.endpoint = "https://myaccount.blob.core.windows.net"
        self.Storage.container_name = "my-container"
        self.file_content = b"test content"
        self.filename = "test.txt"
        self.filename_extra = "test_extra.txt"
        self.file_bytesio_empty = io.BytesIO()

        # Apply mocks to the Storage instance
        self.Storage.blob_service_client = mock_blob_service_client
        self.Storage.container_client = mock_container_client

    def test_upload_file(self, monkeypatch, tmp_path):
        """Test the upload_file method of the Storage class.

        This test function verifies the behavior of the upload_file method when
        uploading a file to Azure Blob Storage. It simulates scenarios where the
        container does not exist and where an empty file is attempted to be
        uploaded. The function uses pytest to assert that the correct exceptions
        are raised and that the upload process behaves as expected when the
        container is available.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for
                temporary modifications of objects for testing purposes.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)

        # Simulate an error when container does not exist
        self.Storage.container_client.get_blob_client.side_effect = Exception(
            "Container does not exist"
        )
        with pytest.raises(Exception):
            self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)

        # Reset side effect and create container
        self.Storage.container_client.get_blob_client.side_effect = None
        self.Storage.create_container()
        contents, azure_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )

        # Assertions
        self.Storage.container_client.get_blob_client.assert_called_with(self.filename)
        self.Storage.container_client.get_blob_client().upload_blob.assert_called_once_with(
            self.file_content, overwrite=True
        )
        assert contents == self.file_content
        assert (
            azure_file_path
            == f"https://myaccount.blob.core.windows.net/{self.Storage.container_name}/{self.filename}"
        )
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content

        with pytest.raises(ValueError):
            self.Storage.upload_file(self.file_bytesio_empty, self.filename)

    def test_get_file(self, monkeypatch, tmp_path):
        """Test the retrieval of a file from the storage service.

        This test function verifies that a file can be uploaded to the storage
        service and then successfully downloaded. It mocks the upload behavior
        and the blob download behavior to ensure that the file is correctly
        stored and can be retrieved from the specified URL. The function checks
        that the file path returned by the storage service matches the expected
        path and that the file content is as expected.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for monkey patching.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary directory.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        self.Storage.create_container()

        # Mock upload behavior
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        # Mock blob download behavior
        self.Storage.container_client.get_blob_client().download_blob().readall.return_value = (
            self.file_content
        )

        file_url = f"https://myaccount.blob.core.windows.net/{self.Storage.container_name}/{self.filename}"
        file_path = self.Storage.get_file(file_url)

        assert file_path == str(upload_dir / self.filename)
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content

    def test_delete_file(self, monkeypatch, tmp_path):
        """Test the deletion of a file from the storage.

        This test function verifies that a file can be successfully deleted from
        the storage system. It sets up a mock environment, uploads a file, and
        then calls the delete function to remove the file. The test checks that
        the delete operation was called exactly once and confirms that the file
        no longer exists in the upload directory.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for monkey patching.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary directory.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        self.Storage.create_container()

        # Mock file upload
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        # Mock deletion
        self.Storage.container_client.get_blob_client().delete_blob.return_value = None

        file_url = f"https://myaccount.blob.core.windows.net/{self.Storage.container_name}/{self.filename}"
        self.Storage.delete_file(file_url)

        self.Storage.container_client.get_blob_client().delete_blob.assert_called_once()
        assert not (upload_dir / self.filename).exists()

    def test_delete_all_files(self, monkeypatch, tmp_path):
        """Test the deletion of all files in the storage.

        This test function verifies that all files uploaded to the storage are
        correctly deleted. It mocks the necessary components to simulate file
        uploads and checks that the deletion process works as expected. The
        function sets up a temporary upload directory, uploads two files, and
        then calls the method to delete all files. After deletion, it asserts
        that the files no longer exist in the upload directory and verifies that
        the appropriate methods were called on the storage client.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
                modifying or mocking parts of the system under test.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        self.Storage.create_container()

        # Mock file uploads
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename)
        self.Storage.upload_file(io.BytesIO(self.file_content), self.filename_extra)

        # Mock listing and deletion behavior
        self.Storage.container_client.list_blobs.return_value = [
            {"name": self.filename},
            {"name": self.filename_extra},
        ]
        self.Storage.container_client.get_blob_client().delete_blob.return_value = None

        self.Storage.delete_all_files()

        self.Storage.container_client.list_blobs.assert_called_once()
        self.Storage.container_client.get_blob_client().delete_blob.assert_any_call()
        assert not (upload_dir / self.filename).exists()
        assert not (upload_dir / self.filename_extra).exists()

    def test_get_file_not_found(self, monkeypatch):
        """Test the behavior of getting a file when the blob is not found.

        This test simulates the scenario where a file is requested from a
        storage container, but the blob does not exist. It uses mocking to raise
        an exception when attempting to download the blob, ensuring that the
        appropriate error handling is in place in the `get_file` method.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
        """

        self.Storage.create_container()

        file_url = f"https://myaccount.blob.core.windows.net/{self.Storage.container_name}/{self.filename}"
        # Mock behavior to raise an error for missing blobs
        self.Storage.container_client.get_blob_client().download_blob.side_effect = (
            Exception("Blob not found")
        )
        with pytest.raises(Exception, match="Blob not found"):
            self.Storage.get_file(file_url)
