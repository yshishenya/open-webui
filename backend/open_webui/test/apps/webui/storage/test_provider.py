import io
import os
import boto3
import pytest
from botocore.exceptions import ClientError
from moto import mock_aws
from open_webui.storage import provider
from gcp_storage_emulator.server import create_server
from google.cloud import storage


def mock_upload_dir(monkeypatch, tmp_path):
    """Fixture to monkey-patch the UPLOAD_DIR and create a temporary directory.

    This function creates a temporary directory for uploads by using the
    provided `tmp_path` fixture. It then monkey-patches the `UPLOAD_DIR`
    attribute of the `provider` module to point to this newly created
    directory. This is useful for testing purposes where a specific upload
    directory is needed without affecting the actual file system.

    Args:
        monkeypatch (MonkeyPatch): The monkeypatching fixture provided by
        tmp_path (Path): A temporary directory path provided by pytest.

    Returns:
        Path: The path to the created temporary upload directory.
    """
    directory = tmp_path / "uploads"
    directory.mkdir()
    monkeypatch.setattr(provider, "UPLOAD_DIR", str(directory))
    return directory


def test_imports():
    """Test the import of various storage provider classes.

    This function checks the availability of different storage provider
    classes from the `provider` module. It ensures that the necessary
    classes are imported correctly, which is essential for the functionality
    of the application that relies on these storage providers.
    """

    provider.StorageProvider
    provider.LocalStorageProvider
    provider.S3StorageProvider
    provider.GCSStorageProvider
    provider.Storage


def test_get_storage_provider():
    """Test the retrieval of storage providers from the provider module.

    This function tests the `get_storage_provider` method from the
    `provider` module to ensure that it correctly returns instances of the
    expected storage provider classes for valid input strings. It also
    verifies that an invalid input string raises a RuntimeError as expected.
    """

    Storage = provider.get_storage_provider("local")
    assert isinstance(Storage, provider.LocalStorageProvider)
    Storage = provider.get_storage_provider("s3")
    assert isinstance(Storage, provider.S3StorageProvider)
    Storage = provider.get_storage_provider("gcs")
    assert isinstance(Storage, provider.GCSStorageProvider)
    with pytest.raises(RuntimeError):
        provider.get_storage_provider("invalid")


def test_class_instantiation():
    """Test the instantiation of storage provider classes.

    This function verifies that the appropriate exceptions are raised when
    attempting to instantiate the `StorageProvider` class directly or when
    subclassing it without implementing required methods. It also checks
    that the concrete implementations of storage providers, such as
    `LocalStorageProvider`, `S3StorageProvider`, and `GCSStorageProvider`,
    can be instantiated without raising exceptions.
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


class TestLocalStorageProvider:
    Storage = provider.LocalStorageProvider()
    file_content = b"test content"
    file_bytesio = io.BytesIO(file_content)
    filename = "test.txt"
    filename_extra = "test_exyta.txt"
    file_bytesio_empty = io.BytesIO()

    def test_upload_file(self, monkeypatch, tmp_path):
        """Test the upload_file method of the Storage class.

        This test function verifies that the upload_file method correctly
        uploads a file to the specified directory and checks that the contents
        of the uploaded file match the expected content. It also tests that a
        ValueError is raised when attempting to upload an empty file.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for
                temporary modifications of objects.
            tmp_path (py.path.local): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        contents, file_path = self.Storage.upload_file(self.file_bytesio, self.filename)
        assert (upload_dir / self.filename).exists()
        assert (upload_dir / self.filename).read_bytes() == self.file_content
        assert contents == self.file_content
        assert file_path == str(upload_dir / self.filename)
        with pytest.raises(ValueError):
            self.Storage.upload_file(self.file_bytesio_empty, self.filename)

    def test_get_file(self, monkeypatch, tmp_path):
        """Test the retrieval of a file from storage.

        This function tests the `get_file` method of the `Storage` class by
        setting up a mock upload directory and verifying that the file path
        returned by the `get_file` method matches the expected file path.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
                for monkey patching during tests.
            tmp_path (py.path.local): A pytest fixture that provides a
                temporary directory unique to the test invocation.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        file_path = str(upload_dir / self.filename)
        file_path_return = self.Storage.get_file(file_path)
        assert file_path == file_path_return

    def test_delete_file(self, monkeypatch, tmp_path):
        """Test the deletion of a file in the storage system.

        This test function verifies that a file can be successfully deleted from
        the specified upload directory. It first creates a mock upload directory
        and writes a file with predefined content. After ensuring that the file
        exists, it calls the delete_file method of the Storage class to remove
        the file. Finally, it checks that the file no longer exists in the
        upload directory.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
                modifying the behavior of objects for testing.
            tmp_path (py.path.local): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        (upload_dir / self.filename).write_bytes(self.file_content)
        assert (upload_dir / self.filename).exists()
        file_path = str(upload_dir / self.filename)
        self.Storage.delete_file(file_path)
        assert not (upload_dir / self.filename).exists()

    def test_delete_all_files(self, monkeypatch, tmp_path):
        """Test the deletion of all files in the storage.

        This test function verifies that all files in the specified upload
        directory are deleted when the `delete_all_files` method of the storage
        is called. It sets up a temporary directory, writes test files to it,
        and then checks that the files no longer exist after the deletion
        operation.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
                modifying the behavior of objects for testing.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

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
        """Test the upload_file method of the Storage class.

        This test function verifies the behavior of the upload_file method when
        uploading a file to both an S3 bucket and a local directory. It checks
        that the file is correctly uploaded to S3 and that the local file exists
        with the expected content. The function also tests for exceptions that
        should be raised under certain conditions, such as when attempting to
        upload an empty file.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
                temporary modifications of objects.
            tmp_path (py.path.local): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

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
        """Test the retrieval of a file from S3 storage.

        This test function verifies that a file uploaded to S3 can be
        successfully retrieved and that the retrieved file exists in the
        expected upload directory. It uses a temporary path for the upload
        directory and mocks the necessary components to isolate the test
        environment.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for
                modifying or mocking parts of the system during the test.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary
                directory unique to the test invocation.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        self.s3_client.create_bucket(Bucket=self.Storage.bucket_name)
        contents, s3_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        file_path = self.Storage.get_file(s3_file_path)
        assert file_path == str(upload_dir / self.filename)
        assert (upload_dir / self.filename).exists()

    def test_delete_file(self, monkeypatch, tmp_path):
        """Test the deletion of a file from S3 storage.

        This test function verifies that a file can be uploaded to an S3 bucket
        and subsequently deleted. It uses a temporary directory to simulate the
        upload location and checks that the file exists before deletion and does
        not exist afterward. Additionally, it confirms that attempting to access
        the deleted file results in a "Not Found" error from the S3 client.

        Args:
            monkeypatch (pytest.MonkeyPatch): A fixture that allows for monkey patching during tests.
            tmp_path (pathlib.Path): A fixture that provides a temporary directory unique to the test
                invocation.
        """

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
        """Test the deletion of all files in the storage.

        This test function verifies the behavior of the `delete_all_files`
        method in the storage class. It first uploads two files to a mock S3
        bucket and checks that they exist both in the S3 bucket and in the local
        upload directory. After invoking the `delete_all_files` method, it
        asserts that the files are no longer present in both locations.
        Additionally, it checks that attempting to load the deleted files raises
        a `ClientError` with a 404 status code, indicating that the files were
        not found.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for monkey patching.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary directory unique to the test
                invocation.
        """

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
        """Set up a local storage emulator and create a Google Cloud Storage
        bucket.

        This method initializes a local server for the storage emulator, sets
        the environment variable for the storage emulator host, and creates a
        Google Cloud Storage bucket. After the setup, it yields control back to
        the caller. Upon completion, it ensures that the created bucket is
        deleted and the server is stopped.

        Yields:
            None: Control is yielded back to the caller after setup.
        """

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
        """Test the upload_file method of the Storage class.

        This test function verifies the behavior of the upload_file method in
        various scenarios. It checks for proper handling of file uploads,
        including cases where the storage bucket does not exist and when an
        empty file is uploaded. The function uses pytest to assert expected
        outcomes, ensuring that the uploaded content matches the original file
        content and that the file is correctly stored in the specified upload
        directory.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows for monkey patching.
            tmp_path (pathlib.Path): A pytest fixture that provides a temporary directory.
            setup (Any): A setup fixture for initializing test conditions.
        """

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
        """Test the retrieval of a file from storage.

        This function tests the `get_file` method of the storage class by first
        uploading a file and then verifying that the file can be retrieved
        correctly. It uses a temporary directory for uploads and checks that the
        file exists in the expected location after retrieval.

        Args:
            monkeypatch: A pytest fixture that allows for monkey patching during tests.
            tmp_path: A pytest fixture that provides a temporary directory unique to the test
                invocation.
            setup: A fixture that prepares the necessary context for the test.
        """

        upload_dir = mock_upload_dir(monkeypatch, tmp_path)
        contents, gcs_file_path = self.Storage.upload_file(
            io.BytesIO(self.file_content), self.filename
        )
        file_path = self.Storage.get_file(gcs_file_path)
        assert file_path == str(upload_dir / self.filename)
        assert (upload_dir / self.filename).exists()

    def test_delete_file(self, monkeypatch, tmp_path, setup):
        """Test the deletion of a file from Google Cloud Storage.

        This function tests the process of uploading a file to Google Cloud
        Storage and then deleting it. It verifies that the file exists in both
        the local directory and the cloud storage before deletion, and checks
        that both locations no longer contain the file after the deletion
        operation. The test uses a temporary path for uploads and a monkeypatch
        to mock the upload directory.

        Args:
            monkeypatch (pytest.MonkeyPatch): A fixture that allows for monkey patching during tests.
            tmp_path (pathlib.Path): A temporary directory provided by pytest for file operations.
            setup: A fixture that sets up the necessary preconditions for the test.
        """

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

        This test function verifies that all files uploaded to the storage can
        be successfully deleted. It first uploads two files and checks their
        existence and content in the specified upload directory. After
        confirming that the files are correctly uploaded, it calls the
        `delete_all_files` method to remove them and asserts that both files no
        longer exist in the upload directory and that they are no longer
        retrievable from the storage bucket.

        Args:
            monkeypatch (pytest.MonkeyPatch): A pytest fixture that allows
                for monkey patching during tests.
            tmp_path (pathlib.Path): A pytest fixture that provides a
                temporary directory unique to the test invocation.
            setup: A fixture or setup method that prepares the test environment.
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
