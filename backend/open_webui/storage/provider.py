import os
import shutil
import json
from abc import ABC, abstractmethod
from typing import BinaryIO, Tuple

import boto3
from botocore.exceptions import ClientError
from open_webui.config import (
    S3_ACCESS_KEY_ID,
    S3_BUCKET_NAME,
    S3_ENDPOINT_URL,
    S3_REGION_NAME,
    S3_SECRET_ACCESS_KEY,
    GCS_BUCKET_NAME,
    GOOGLE_APPLICATION_CREDENTIALS_JSON,
    STORAGE_PROVIDER,
    UPLOAD_DIR,
)
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError, NotFound
from open_webui.constants import ERROR_MESSAGES


class StorageProvider(ABC):
    @abstractmethod
    def get_file(self, file_path: str) -> str:
        pass

    @abstractmethod
    def upload_file(self, file: BinaryIO, filename: str) -> Tuple[bytes, str]:
        pass

    @abstractmethod
    def delete_all_files(self) -> None:
        pass

    @abstractmethod
    def delete_file(self, file_path: str) -> None:
        pass


class LocalStorageProvider(StorageProvider):
    @staticmethod
    def upload_file(file: BinaryIO, filename: str) -> Tuple[bytes, str]:
        """Upload a file to the specified directory.

        This function reads the contents of a binary file and writes it to a
        specified location on the filesystem. It raises an error if the file is
        empty. The function returns the contents of the file and the path where
        it was saved.

        Args:
            file (BinaryIO): A binary file-like object to be uploaded.
            filename (str): The name of the file to be saved.

        Returns:
            Tuple[bytes, str]: A tuple containing the contents of the file and the path
            where the file was saved.

        Raises:
            ValueError: If the contents of the file are empty.
        """

        contents = file.read()
        if not contents:
            raise ValueError(ERROR_MESSAGES.EMPTY_CONTENT)
        file_path = f"{UPLOAD_DIR}/{filename}"
        with open(file_path, "wb") as f:
            f.write(contents)
        return contents, file_path

    @staticmethod
    def get_file(file_path: str) -> str:
        """Handles downloading of the file from local storage.

        This function takes a file path as input and returns the same file path.
        It is intended to be a placeholder for future implementation of file
        downloading logic from local storage. Currently, it does not perform any
        actual file handling or downloading operations.

        Args:
            file_path (str): The path to the file in local storage.

        Returns:
            str: The input file path.
        """
        return file_path

    @staticmethod
    def delete_file(file_path: str) -> None:
        """Handles deletion of the file from local storage.

        This function takes a file path as input, constructs the full path to
        the file in the local storage, and attempts to delete it. If the file
        exists, it is removed from the storage. If the file does not exist, a
        message is printed indicating that the file was not found.

        Args:
            file_path (str): The path of the file to be deleted.

        Returns:
            None: This function does not return any value.
        """
        filename = file_path.split("/")[-1]
        file_path = f"{UPLOAD_DIR}/{filename}"
        if os.path.isfile(file_path):
            os.remove(file_path)
        else:
            print(f"File {file_path} not found in local storage.")

    @staticmethod
    def delete_all_files() -> None:
        """Handles deletion of all files from local storage.

        This function checks if the specified upload directory exists. If it
        does, it iterates through all files and directories within that
        directory. For each item, it attempts to delete files and symbolic links
        using `os.unlink()` and directories using `shutil.rmtree()`. If any
        deletion fails, an error message is printed to the console indicating
        the failure reason. If the upload directory does not exist, a message is
        printed stating that the directory was not found.
        """
        if os.path.exists(UPLOAD_DIR):
            for filename in os.listdir(UPLOAD_DIR):
                file_path = os.path.join(UPLOAD_DIR, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)  # Remove the file or link
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)  # Remove the directory
                except Exception as e:
                    print(f"Failed to delete {file_path}. Reason: {e}")
        else:
            print(f"Directory {UPLOAD_DIR} not found in local storage.")


class S3StorageProvider(StorageProvider):
    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            region_name=S3_REGION_NAME,
            endpoint_url=S3_ENDPOINT_URL,
            aws_access_key_id=S3_ACCESS_KEY_ID,
            aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        )
        self.bucket_name = S3_BUCKET_NAME

    def upload_file(self, file: BinaryIO, filename: str) -> Tuple[bytes, str]:
        """Handles uploading of the file to S3 storage.

        This method takes a file and its corresponding filename, uploads the
        file to an S3 bucket, and returns the file's content along with its S3
        URI. It first uploads the file to a local storage provider and then uses
        the S3 client to upload the file to the specified bucket. If the upload
        fails, it raises a RuntimeError with details about the failure.

        Args:
            file (BinaryIO): The file object to be uploaded.
            filename (str): The name under which the file will be stored in S3.

        Returns:
            Tuple[bytes, str]: A tuple containing the file's content as bytes and
            the S3 URI of the uploaded file.

        Raises:
            RuntimeError: If there is an error during the upload process to S3.
        """
        _, file_path = LocalStorageProvider.upload_file(file, filename)
        try:
            self.s3_client.upload_file(file_path, self.bucket_name, filename)
            return (
                open(file_path, "rb").read(),
                "s3://" + self.bucket_name + "/" + filename,
            )
        except ClientError as e:
            raise RuntimeError(f"Error uploading file to S3: {e}")

    def get_file(self, file_path: str) -> str:
        """Handles downloading of a file from S3 storage.

        This function takes a file path, extracts the bucket name and key, and
        downloads the specified file from S3 to a local directory. The local
        file path is constructed using a predefined upload directory and the key
        extracted from the file path. If the download fails, a RuntimeError is
        raised with details about the failure.

        Args:
            file_path (str): The S3 file path in the format 's3://bucket_name/key'.

        Returns:
            str: The local file path where the file has been downloaded.

        Raises:
            RuntimeError: If there is an error downloading the file from S3.
        """
        try:
            bucket_name, key = file_path.split("//")[1].split("/")
            local_file_path = f"{UPLOAD_DIR}/{key}"
            self.s3_client.download_file(bucket_name, key, local_file_path)
            return local_file_path
        except ClientError as e:
            raise RuntimeError(f"Error downloading file from S3: {e}")

    def delete_file(self, file_path: str) -> None:
        """Handles the deletion of a file from S3 storage.

        This function takes a file path as input, extracts the filename, and
        attempts to delete the corresponding object from an S3 bucket. If the
        deletion from S3 fails due to a client error, it raises a RuntimeError
        with a descriptive message. Regardless of the outcome with S3, it also
        ensures that the file is deleted from local storage.

        Args:
            file_path (str): The path of the file to be deleted.

        Raises:
            RuntimeError: If there is an error deleting the file from S3.
        """
        filename = file_path.split("/")[-1]
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=filename)
        except ClientError as e:
            raise RuntimeError(f"Error deleting file from S3: {e}")

        # Always delete from local storage
        LocalStorageProvider.delete_file(file_path)

    def delete_all_files(self) -> None:
        """Handles deletion of all files from S3 storage.

        This function connects to an S3 bucket and attempts to delete all files
        contained within it. It first retrieves a list of objects in the
        specified bucket and iterates through each object, deleting them one by
        one. After the deletion from S3, it also ensures that all files are
        removed from local storage.

        Raises:
            RuntimeError: If there is an error during the deletion process from S3.
        """
        try:
            response = self.s3_client.list_objects_v2(Bucket=self.bucket_name)
            if "Contents" in response:
                for content in response["Contents"]:
                    self.s3_client.delete_object(
                        Bucket=self.bucket_name, Key=content["Key"]
                    )
        except ClientError as e:
            raise RuntimeError(f"Error deleting all files from S3: {e}")

        # Always delete from local storage
        LocalStorageProvider.delete_all_files()


class GCSStorageProvider(StorageProvider):
    def __init__(self):
        self.bucket_name = GCS_BUCKET_NAME

        if GOOGLE_APPLICATION_CREDENTIALS_JSON:
            self.gcs_client = storage.Client.from_service_account_info(
                info=json.loads(GOOGLE_APPLICATION_CREDENTIALS_JSON)
            )
        else:
            # if no credentials json is provided, credentials will be picked up from the environment
            # if running on local environment, credentials would be user credentials
            # if running on a Compute Engine instance, credentials would be from Google Metadata server
            self.gcs_client = storage.Client()
        self.bucket = self.gcs_client.bucket(GCS_BUCKET_NAME)

    def upload_file(self, file: BinaryIO, filename: str) -> Tuple[bytes, str]:
        """Handles uploading of the file to Google Cloud Storage (GCS).

        This method takes a binary file and a filename as input, uploads the
        file to GCS, and returns the contents of the file along with the GCS
        path. It first calls the `upload_file` method of `LocalStorageProvider`
        to handle local storage, then uploads the file to the specified GCS
        bucket. If an error occurs during the upload, it raises a RuntimeError
        with details about the failure.

        Args:
            file (BinaryIO): The binary file to be uploaded.
            filename (str): The name under which the file will be stored in GCS.

        Returns:
            Tuple[bytes, str]: A tuple containing the contents of the file and the GCS path.

        Raises:
            RuntimeError: If there is an error uploading the file to GCS.
        """
        contents, file_path = LocalStorageProvider.upload_file(file, filename)
        try:
            blob = self.bucket.blob(filename)
            blob.upload_from_filename(file_path)
            return contents, "gs://" + self.bucket_name + "/" + filename
        except GoogleCloudError as e:
            raise RuntimeError(f"Error uploading file to GCS: {e}")

    def get_file(self, file_path: str) -> str:
        """Handles downloading of a file from Google Cloud Storage (GCS).

        This function takes a file path in the GCS format, retrieves the
        corresponding file from the specified GCS bucket, and downloads it to a
        local directory. The local file path is constructed using a predefined
        upload directory and the filename extracted from the GCS path. If the
        file is not found in the GCS bucket, a RuntimeError is raised.

        Args:
            file_path (str): The path of the file in GCS format (e.g., gs://bucket_name/file_name).

        Returns:
            str: The local file path where the file has been downloaded.

        Raises:
            RuntimeError: If the file is not found in the GCS bucket.
        """
        try:
            filename = file_path.removeprefix("gs://").split("/")[1]
            local_file_path = f"{UPLOAD_DIR}/{filename}"
            blob = self.bucket.get_blob(filename)
            blob.download_to_filename(local_file_path)

            return local_file_path
        except NotFound as e:
            raise RuntimeError(f"Error downloading file from GCS: {e}")

    def delete_file(self, file_path: str) -> None:
        """Handles deletion of the file from GCS storage.

        This function attempts to delete a specified file from Google Cloud
        Storage (GCS) by extracting the filename from the provided file path. If
        the file is not found in GCS, a RuntimeError is raised. Regardless of
        the outcome in GCS, the function also ensures that the file is deleted
        from local storage.

        Args:
            file_path (str): The path of the file to be deleted, formatted as a GCS URI.

        Raises:
            RuntimeError: If the file does not exist in GCS.
        """
        try:
            filename = file_path.removeprefix("gs://").split("/")[1]
            blob = self.bucket.get_blob(filename)
            blob.delete()
        except NotFound as e:
            raise RuntimeError(f"Error deleting file from GCS: {e}")

        # Always delete from local storage
        LocalStorageProvider.delete_file(file_path)

    def delete_all_files(self) -> None:
        """Handles the deletion of all files from Google Cloud Storage (GCS).

        This function retrieves all blobs (files) from the specified GCS bucket
        and deletes each one. It also ensures that all files are deleted from
        local storage by invoking the appropriate method from the
        LocalStorageProvider class. If an error occurs during the deletion
        process, a RuntimeError is raised with a descriptive message.

        Raises:
            RuntimeError: If there is an error deleting files from GCS.
        """
        try:
            blobs = self.bucket.list_blobs()

            for blob in blobs:
                blob.delete()

        except NotFound as e:
            raise RuntimeError(f"Error deleting all files from GCS: {e}")

        # Always delete from local storage
        LocalStorageProvider.delete_all_files()


def get_storage_provider(storage_provider: str):
    """Get the appropriate storage provider based on the input string.

    This function returns an instance of a storage provider class based on
    the specified storage provider type. It supports 'local', 's3', and
    'gcs' as valid options. If an unsupported storage provider is provided,
    a RuntimeError is raised.

    Args:
        storage_provider (str): The type of storage provider to instantiate.
            Valid options are 'local', 's3', and 'gcs'.

    Returns:
        Storage: An instance of the corresponding storage provider class.

    Raises:
        RuntimeError: If the provided storage provider is not supported.
    """

    if storage_provider == "local":
        Storage = LocalStorageProvider()
    elif storage_provider == "s3":
        Storage = S3StorageProvider()
    elif storage_provider == "gcs":
        Storage = GCSStorageProvider()
    else:
        raise RuntimeError(f"Unsupported storage provider: {storage_provider}")
    return Storage


Storage = get_storage_provider(STORAGE_PROVIDER)
