pipeline {
  agent none

  stages {
    stage('CI - Build') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root:root'
          reuseNode true
        }
      }
      steps {
        sh 'node -v'
        sh 'npm -v'
        sh 'npm ci'
        sh 'npm run build'
      }
    }

    stage('CD - Deploy Frontend') {
      agent {
        docker {
          image 'docker:27-cli'
          // 掛 docker socket + 讓容器能讀到 workspace 內的 docker-compose.yml
          args '-v /var/run/docker.sock:/var/run/docker.sock -v $WORKSPACE:/work -w /work'
          reuseNode true
        }
      }
      steps {
        sh '''
          docker version
          # 安裝 compose plugin（docker:cli 可能沒有 compose）
          apk add --no-cache docker-cli-compose

          docker compose version
          docker compose up -d --build --force-recreate frontend
        '''
      }
    }
  }
}
