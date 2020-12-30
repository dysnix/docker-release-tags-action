# Github action - Generate release tags for Docker Image

This Action for [Docker](https://www.docker.com/) uses the Git tag to generate stable release tags for your Docker image. This tags list can be used for publishing for example with [docker/build-push-action](https://github.com/docker/build-push-action).

Action generates Docker image tags based on the version retrieved from the tag or the release name (in case this tag or release can be treated as version). When tagging or creating release using versions of the following form: `1.2.1, v0.3.5, 0.4.5-r1 etc`, this action can:

  - Generate `1.2.1`, `1.2`, `1` and `latest` for a tag/release which represents version kind of **1.2.1-r10**. This bahavior is configurable.
  - Automaticaly determine the latest release in repository and omit adding minor, major and latest tags, i.e. it won't overwrite existing tags (useful when releasing older image versions).
  - Generate flavours for container images (such as *onbuild, gcloud* etc)

## Usage

## Example pipeline

```yaml
name: Publish Docker images
on: [push, pull_request]

jobs:
  build:
    name: Build Image Flavour
    runs-on: ubuntu-20.04

    strategy:
      matrix:
        include:
          - flavour: ""
            df: default
          - flavour: onbuild
            df: onbuild
          - flavour: gcloud
            df: gcloud

    steps:
      - 
        uses: actions/checkout@v2
      - 
        uses: docker/setup-buildx-action@v1
      - 
        uses: docker/login-action@v1
        with:
          username: ${{ secrets.DOCKERHUB_USER}}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      -
        name: Generate release tags for Docker Image
        uses: ./.github/actions/docker-tags
        id: image
        with:
          image: dysnix/github-actions-runner
          release-only: false
          flavour: ${{ matrix.flavour }}  
      -
        name: Build and push
        uses: docker/build-push-action@v2
        with:
          context: .
          file: ./Dockerfile.${{ matrix.df }}
          push: ${{ steps.image.outputs.runsOnTag }}
          tags: ${{ steps.image.outputs.tags }}
```

## Arguments

### image (required)

`string`

Specifies the repository image for image list generation. For instance you plan to push to registry **org/image** then you specify so that the action generates corresponding tags list.

### tags-latest

`bool`, `default: true`

Specifies whether the `latest` and `flavour` tags will written. For example publishing images `org/image:latest` and `org/image:flavour`.

**Note**: action will also try to find the latest release through Github releases and tags to compare to the tag which is released. In case the release is not latest no latest/flavour tag will generated.

### release-only

`bool`, `default: false`

To search for the latest release only in Github release (i.e. excluding tags) set this to `true`.

### flavour

`string`

Specifies the image flavour (ex: onbuild, which is added to the tag).

### updates

`string`

Specifies depth of tag creation, set to `minor` or `major` to enable generation of `v1.2` or `v1` together with the full version. Note that these will be also omitted in case not the latest tag is being released.

### token

`string`

Personal access token (auto-populated). It is used only because anonymous requests are rate-limited. It can be overridden to an empty value.

## Outputs

### tags

List of tags generated. For example: `v2.27.13-gcloud-r10`, `v2.27.13-gcloud`, `v2.27-gcloud` and `gcloud`.

### images

Same list as the tags but has the provided image added (`image:`) to each of the tags.

### version

Helpful output which is equal version stripped from `v` and `-r*`

### runsOnTag

Set to `true` if action is running against `refs/tags` (i.e. not a branch).
